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
import { ButtonInteraction, ChatInputCommandInteraction, GuildMember, Interaction } from 'discord.js';
import { stream as streamFromYtLink } from 'play-dl';

import { PlayQueueService } from 'src/play.queue/play.queue.service';
import { DiscordPlayerMessageService } from 'src/discord/discord.player.message.service';
import { DiscordInteractionHelperService } from 'src/discord/discord.interaction.helper.service';

@Injectable()
export class DiscordAudioService {
  private readonly logger = new Logger(DiscordAudioService.name);

  // It's the only known way to interact with the audio player
  // Because we can't pass the player instance to the interaction handler
  private readonly playerByGuildId = new Map<string, AudioPlayer>();

  constructor(
    private readonly playQueueService: PlayQueueService,
    private readonly discordPlayerMessageService: DiscordPlayerMessageService,
    private readonly discordInteractionHelperService: DiscordInteractionHelperService,
  ) {}

  public async playAudio({
    interaction,
    onSuccess,
  }: {
    interaction: ChatInputCommandInteraction;
    onSuccess: () => void;
  }): Promise<void> {
    const connection = this.getConnection(interaction);
    const player = createAudioPlayer();
    this.playerByGuildId.set(interaction.guild.id, player);

    connection.on(VoiceConnectionStatus.Ready, async () => {
      await this.onConnectionReady(interaction.guild.id, connection, player);
      onSuccess();
    });

    player.on('stateChange', async (_, { status }) => {
      if (status === AudioPlayerStatus.Idle) {
        await this.onAudioPlayerIdle(interaction, connection);
      }
    });

    connection.on('error', (error) => {
      this.logger.error('An error occurred with the voice connection.', error);
      this.discordPlayerMessageService.delete(interaction.guild.id);
      this.playQueueService.destroyQueue(interaction.guild.id);
    });
    connection.on(VoiceConnectionStatus.Disconnected, () => {
      this.playQueueService.destroyQueue(interaction.guild.id);
      this.discordPlayerMessageService.delete(interaction.guild.id);
    });
    connection.on(VoiceConnectionStatus.Destroyed, () => {
      this.playQueueService.destroyQueue(interaction.guild.id);
      this.discordPlayerMessageService.delete(interaction.guild.id);
    });
  }

  public pauseOrPlayAudio(interaction: ButtonInteraction): void {
    const player = this.playerByGuildId.get(interaction.guild.id);
    if (!player) {
      return;
    }

    if (player.state.status === AudioPlayerStatus.Paused) {
      player.unpause();
      this.discordInteractionHelperService.replyAndDeleteAfterDelay({ message: '▶️ Resumed', interaction });
      return;
    }

    player.pause();
    this.discordInteractionHelperService.replyAndDeleteAfterDelay({ message: '⏸️ Paused', interaction });
  }

  private async onAudioPlayerIdle(
    interaction: ChatInputCommandInteraction,
    connection: VoiceConnection,
  ): Promise<void> {
    const nextItem = await this.playQueueService.getNextItem({
      guildId: interaction.guild.id,
    });
    if (!nextItem) {
      connection.destroy();
      this.playQueueService.destroyQueue(interaction.guild.id);
      this.discordPlayerMessageService.delete(interaction.guild.id);

      return;
    }

    await this.playNextTrack({ interaction });
  }

  public async playNextTrack({
    interaction,
    stopCurrent,
    replyToInteraction,
  }: {
    interaction: ButtonInteraction | ChatInputCommandInteraction;
    stopCurrent?: boolean;
    replyToInteraction?: boolean;
  }): Promise<void> {
    const player = this.playerByGuildId.get(interaction.guild.id);
    const nextItem = await this.playQueueService.getNextItem({
      guildId: interaction.guild.id,
    });
    if (!player || !nextItem) {
      if (replyToInteraction) {
        this.discordInteractionHelperService.replyAndDeleteAfterDelay({
          message: 'No items in the queue',
          interaction,
        });
      }
      return;
    }

    if (replyToInteraction) {
      this.discordInteractionHelperService.replyAndDeleteAfterDelay({ message: 'Playing next track', interaction });
    }

    await this.discordPlayerMessageService.sendCurrentTrackDetails(interaction);

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
      this.discordInteractionHelperService.replyAndDeleteAfterDelay({ message: 'No items in the queue', interaction });
      return;
    }

    this.discordInteractionHelperService.replyAndDeleteAfterDelay({ message: 'Playing previous track', interaction });

    await this.discordPlayerMessageService.sendCurrentTrackDetails(interaction);

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

  private getConnection(interaction: Interaction): VoiceConnection {
    const existingConnection = getVoiceConnection(interaction.guild.id);
    if (existingConnection) {
      return existingConnection;
    }

    return joinVoiceChannel({
      channelId: (interaction.member as GuildMember).voice.channel.id,
      guildId: interaction.guild.id,
      adapterCreator: interaction.guild.voiceAdapterCreator,
      selfDeaf: true,
    });
  }
}
