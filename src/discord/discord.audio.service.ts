import { Injectable, Logger } from '@nestjs/common';
import {
  AudioPlayer,
  AudioPlayerState,
  AudioPlayerStatus,
  VoiceConnection,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  getVoiceConnection,
  joinVoiceChannel,
} from '@discordjs/voice';
import { Guild, GuildMember, MessagePayload } from 'discord.js';
import { stream as streamFromYtLink } from 'play-dl';

import { InteractionOrGuildId, InteractionOrUserId } from 'src/discord/types';
import { PlayQueueService } from 'src/play.queue/play.queue.service';
import { DiscordClientService } from 'src/discord/discord.client.service';
import { DiscordGuildService } from 'src/discord/discord.guild.service';
import { DiscordMessageService } from 'src/discord/discord.message.service';
import { DiscordPlayerMessageService } from 'src/discord/player/discord.player.message.service';

@Injectable()
export class DiscordAudioService {
  private readonly logger = new Logger(DiscordAudioService.name);

  // It's the only known way to interact with the audio player
  // Because we can't pass the player instance to the interaction handler
  private readonly playerByGuildId = new Map<string, AudioPlayer>();

  constructor(
    private readonly playQueueService: PlayQueueService,
    private readonly discordPlayerMessageService: DiscordPlayerMessageService,
    private readonly discordMessageService: DiscordMessageService,
    private readonly discordGuildService: DiscordGuildService,
    private readonly discordClientService: DiscordClientService,
  ) {}

  public getCurrentPlayerStateByGuildId(guildId: string): AudioPlayerState | undefined {
    const player = this.playerByGuildId.get(guildId);
    return player?.state;
  }

  public async startAudio({
    userId,
    guildId,
    interaction,
    sourceUrl,
  }: { sourceUrl: string } & InteractionOrUserId & InteractionOrGuildId): Promise<void> {
    const connection = await this.getConnection({ interaction, userId, guildId });
    const player = createAudioPlayer();
    this.playerByGuildId.set(guildId, player);

    await new Promise<void>((resolve, reject) =>
      connection.on(VoiceConnectionStatus.Ready, async () => {
        try {
          await this.createNewStreamAndPlayAudio({ connection, player, sourceUrl });
          await this.playQueueService.markItemAsPlayed({ guildId, itemUrl: sourceUrl });
          resolve();
        } catch (e) {
          reject(e);
        }
      }),
    );

    player.on('stateChange', async (_, { status }) => {
      if (status === AudioPlayerStatus.Idle) {
        await this.onAudioPlayerIdle({ interaction, guildId });
      }
    });

    connection.on('error', (error) => {
      this.logger.error('An error occurred with the voice connection.', error);
      this.discordPlayerMessageService.delete(guildId);
      this.playQueueService.destroyQueue(guildId);
    });
    // connection.on(VoiceConnectionStatus.Disconnected, () => {
    // this.playQueueService.destroyQueue(guildId);
    // this.discordPlayerMessageService.delete(guildId);
    // });
    // connection.on(VoiceConnectionStatus.Destroyed, () => {
    // this.playQueueService.destroyQueue(guildId);
    // this.discordPlayerMessageService.delete(guildId);
    // });
  }

  public async pauseOrPlayAudio(guildId: string): Promise<MessagePayload | string> {
    const player = this.playerByGuildId.get(guildId);
    if (!player) {
      return 'Player not found';
    }

    if (player.state.status === AudioPlayerStatus.Paused) {
      player.unpause();
      return '▶️ Resumed';
    }

    player.pause();
    return '⏸️ Paused';
  }

  private async onAudioPlayerIdle({ interaction, guildId }: InteractionOrGuildId): Promise<void> {
    const nextItem = await this.playQueueService.getNextItem({ guildId });

    if (!nextItem) {
      const message = await this.disconnectFromVoiceChannel(guildId);
      await this.discordMessageService.replyAndDeleteAfterDelay({
        message,
        interaction,
        guildId,
      });

      return;
    }

    await this.playNextTrack(guildId);
  }

  public async disconnectFromVoiceChannel(guildId: string): Promise<MessagePayload | string> {
    const connection = getVoiceConnection(guildId);
    connection?.destroy();

    await this.playQueueService.destroyQueue(guildId);
    await this.discordPlayerMessageService.delete(guildId);

    return 'Disconnected from the voice channel';
  }

  public async playNextTrack(guildId: string): Promise<MessagePayload | string> {
    const player = this.playerByGuildId.get(guildId);
    const nextItem = await this.playQueueService.getNextItem({ guildId });

    if (!player || !nextItem) {
      return 'No items in the queue';
    }

    const { stream } = await streamFromYtLink(nextItem.url, {
      discordPlayerCompatibility: true,
    });
    const resource = createAudioResource(stream);

    player.play(resource);
  }

  public async playPrevTrack(guildId: string): Promise<MessagePayload | string> {
    const player = this.playerByGuildId.get(guildId);
    const prevItem = await this.playQueueService.getPrevItem(guildId);

    if (!player || !prevItem) {
      return 'No items in the queue';
    }

    const { stream } = await streamFromYtLink(prevItem.url, {
      discordPlayerCompatibility: true,
    });
    const resource = createAudioResource(stream);

    player.stop();
    player.play(resource);

    return 'Playing previous track';
  }

  private async createNewStreamAndPlayAudio({
    sourceUrl,
    player,
    connection,
  }: {
    connection: VoiceConnection;
    player: AudioPlayer;
    sourceUrl: string;
  }): Promise<void> {
    const { stream } = await streamFromYtLink(sourceUrl, {
      discordPlayerCompatibility: true,
    });
    const resource = createAudioResource(stream);
    connection.subscribe(player);
    player.play(resource);
  }

  private async getConnection({
    interaction,
    guildId,
    userId,
  }: InteractionOrUserId & InteractionOrGuildId): Promise<VoiceConnection> {
    const existingConnection = getVoiceConnection(guildId);
    if (existingConnection) {
      return existingConnection;
    }

    const channelId = interaction
      ? (interaction.member as GuildMember).voice.channel.id
      : await this.getUserActiveVoiceChannelId(userId);

    const adapterCreator = interaction
      ? interaction.guild.voiceAdapterCreator
      : (await this.getActiveGuild(userId)).voiceAdapterCreator;

    return joinVoiceChannel({ channelId, guildId, adapterCreator, selfDeaf: true });
  }

  private async getUserActiveVoiceChannelId(userId: string): Promise<string | null> {
    const guild = await this.getActiveGuild(userId);
    const member = await guild?.members?.fetch(userId);
    return member?.voice?.channel?.id;
  }

  private async getActiveGuild(userId: string): Promise<Guild> {
    const activeGuildId = await this.discordGuildService.getActiveGuildId({ userId, interaction: undefined });
    return await this.discordClientService.client.guilds.fetch(activeGuildId);
  }
}
