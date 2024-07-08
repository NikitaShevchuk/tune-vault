import { Injectable, Logger } from '@nestjs/common';
import {
  AudioPlayer,
  AudioPlayerStatus,
  VoiceConnection,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  getVoiceConnection,
  joinVoiceChannel,
} from '@discordjs/voice';
import { ButtonInteraction, ChatInputCommandInteraction, Guild, GuildMember } from 'discord.js';
import { stream as streamFromYtLink } from 'play-dl';

import { InteractionOrUserId } from 'src/discord/types';
import { PlayQueueService } from 'src/play.queue/play.queue.service';
import { DiscordClientService } from 'src/discord/discord.client.service';
import { DiscordGuildService } from 'src/discord/discord.guild.service';
import { DiscordMessageService } from 'src/discord/discord.message.service';
import { DiscordPlayerMessageService } from 'src/discord/discord.player.message.service';

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

  public async startAudio({
    interaction,
    onSuccess,
    userId,
  }: {
    onSuccess: () => void;
  } & InteractionOrUserId<ChatInputCommandInteraction>): Promise<void> {
    const connection = await this.getConnection({ interaction, userId });
    const player = createAudioPlayer();
    const guildId = interaction ? interaction.guild.id : (await this.discordGuildService.getActiveGuild(userId))?.id;
    this.playerByGuildId.set(guildId, player);

    connection.on(VoiceConnectionStatus.Ready, async () => {
      await this.onConnectionReady(guildId, connection, player);
      onSuccess();
    });

    player.on('stateChange', async (_, { status }) => {
      if (status === AudioPlayerStatus.Idle) {
        await this.onAudioPlayerIdle({ interaction, userId });
      }
    });

    connection.on('error', (error) => {
      this.logger.error('An error occurred with the voice connection.', error);
      this.discordPlayerMessageService.delete(guildId);
      this.playQueueService.destroyQueue(guildId);
    });
    connection.on(VoiceConnectionStatus.Disconnected, () => {
      this.playQueueService.destroyQueue(guildId);
      this.discordPlayerMessageService.delete(guildId);
    });
    connection.on(VoiceConnectionStatus.Destroyed, () => {
      this.playQueueService.destroyQueue(guildId);
      this.discordPlayerMessageService.delete(guildId);
    });
  }

  public pauseOrPlayAudio(interaction: ButtonInteraction): void {
    const player = this.playerByGuildId.get(interaction.guild.id);
    if (!player) {
      return;
    }

    if (player.state.status === AudioPlayerStatus.Paused) {
      player.unpause();
      this.discordMessageService.replyAndDeleteAfterDelay({ message: '▶️ Resumed', interaction, userId: undefined });
      return;
    }

    player.pause();
    this.discordMessageService.replyAndDeleteAfterDelay({ message: '⏸️ Paused', interaction, userId: undefined });
  }

  private async onAudioPlayerIdle({
    interaction,
    userId,
  }: InteractionOrUserId<ChatInputCommandInteraction>): Promise<void> {
    const guildId = interaction ? interaction.guild.id : (await this.discordGuildService.getActiveGuild(userId))?.id;
    const nextItem = await this.playQueueService.getNextItem({
      guildId,
    });
    if (!nextItem) {
      this.disconnectFromVoiceChannel({ interaction, userId });
      return;
    }

    await this.playNextTrack({ interaction, userId });
  }

  public async disconnectFromVoiceChannel({
    interaction,
    userId,
  }: InteractionOrUserId<ButtonInteraction | ChatInputCommandInteraction>): Promise<void> {
    const guildId = interaction ? interaction.guild.id : (await this.discordGuildService.getActiveGuild(userId))?.id;
    const connection = getVoiceConnection(guildId);
    connection?.destroy();
    this.discordMessageService.replyAndDeleteAfterDelay({
      interaction,
      message: 'Disconnected from the voice channel',
      userId,
    });
    this.playQueueService.destroyQueue(guildId);

    const currentPlayerMessageId = await this.discordPlayerMessageService.get(guildId);

    if (currentPlayerMessageId) {
      try {
        if (interaction) {
          interaction.channel.messages.delete(currentPlayerMessageId);
        } else {
          const channel = await this.discordMessageService.getActiveTextChannel(userId);
          channel?.messages?.delete(currentPlayerMessageId);
        }
      } catch (e) {
        this.logger.error('Failed to delete the current player message', e);
      }
    }
    this.discordPlayerMessageService.delete(guildId);
  }

  public async playNextTrack({
    interaction,
    stopCurrent,
    replyToInteraction,
    userId,
  }: {
    stopCurrent?: boolean;
    replyToInteraction?: boolean;
  } & InteractionOrUserId<ButtonInteraction | ChatInputCommandInteraction>): Promise<void> {
    const guildId = interaction ? interaction.guild.id : (await this.discordGuildService.getActiveGuild(userId))?.id;
    const player = this.playerByGuildId.get(guildId);
    const nextItem = await this.playQueueService.getNextItem({ guildId });

    if (!player || !nextItem) {
      this.discordMessageService.replyAndDeleteAfterDelay({
        message: 'No items in the queue',
        interaction,
        userId,
      });
      return;
    }

    if (replyToInteraction) {
      this.discordMessageService.replyAndDeleteAfterDelay({
        message: 'Playing next track',
        interaction,
        userId,
      });
    }

    await this.discordPlayerMessageService.sendCurrentTrackDetails({ interaction, userId });

    const { stream } = await streamFromYtLink(nextItem.url, {
      discordPlayerCompatibility: true,
    });
    const resource = createAudioResource(stream);

    if (stopCurrent) {
      player.stop();
    }
    player.stop();
    player.play(resource);
  }

  public async playPrevTrack(interaction: ButtonInteraction): Promise<void> {
    const player = this.playerByGuildId.get(interaction.guild.id);
    const prevItem = await this.playQueueService.getPrevItem(interaction.guild.id);

    if (!player || !prevItem) {
      this.discordMessageService.replyAndDeleteAfterDelay({
        message: 'No items in the queue',
        interaction,
        userId: undefined,
      });
      return;
    }

    this.discordMessageService.replyAndDeleteAfterDelay({
      message: 'Playing previous track',
      interaction,
      userId: undefined,
    });

    await this.discordPlayerMessageService.sendCurrentTrackDetails({ interaction, userId: undefined });

    const { stream } = await streamFromYtLink(prevItem.url, {
      discordPlayerCompatibility: true,
    });
    const resource = createAudioResource(stream);

    player.stop();
    player.play(resource);
  }

  private async onConnectionReady(guildId: string, connection: VoiceConnection, player: AudioPlayer): Promise<void> {
    try {
      const itemToPlay = await this.playQueueService.getNextItem({ guildId });
      if (!itemToPlay) {
        this.logger.error('Warning! No items to play. We should not be here.');
        return;
      }

      const { stream } = await streamFromYtLink(itemToPlay.url, {
        discordPlayerCompatibility: true,
      });
      const resource = createAudioResource(stream);
      connection.subscribe(player);
      player.play(resource);
    } catch (e) {
      this.logger.error('Failed to play audio.', e);
    }
  }

  private async getConnection({ interaction, userId }: InteractionOrUserId): Promise<VoiceConnection> {
    const guildId = interaction ? interaction.guild.id : (await this.discordGuildService.getActiveGuild(userId))?.id;
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
    const activeGuild = await this.discordGuildService.getActiveGuild(userId);
    return await this.discordClientService.client.guilds.fetch(activeGuild?.id);
  }
}
