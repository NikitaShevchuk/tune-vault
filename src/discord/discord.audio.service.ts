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
import { ChatInputCommandInteraction, GuildMember, Interaction } from 'discord.js';
import { stream as streamFromYtLink } from 'play-dl';

import { PlayQueueService } from 'src/play.queue/play.queue.service';
import { DiscordPlayerMessageService } from 'src/discord/discord.player.message.service';

@Injectable()
export class DiscordAudioService {
  private readonly logger = new Logger(DiscordAudioService.name);

  constructor(
    private readonly playQueueService: PlayQueueService,
    private readonly discordPlayerMessageService: DiscordPlayerMessageService,
  ) {}

  public async playAudio(interaction: ChatInputCommandInteraction, onSuccess: () => void): Promise<void> {
    const connection = this.getConnection(interaction);
    const player = createAudioPlayer();

    connection.on(VoiceConnectionStatus.Ready, async () => {
      await this.onConnectionReady(interaction.guild.id, connection, player);
      onSuccess();
    });

    player.on('stateChange', async (_, { status }) => {
      if (status === AudioPlayerStatus.Idle) {
        await this.onAudioPlayerIdle(interaction, connection, player);
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

  private async onAudioPlayerIdle(
    interaction: ChatInputCommandInteraction,
    connection: VoiceConnection,
    player: AudioPlayer,
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

    const interactionReplyPayload = await this.discordPlayerMessageService.getPlayerMessagePayload(
      interaction.guild.id,
    );
    await this.discordPlayerMessageService.editOrCreate(interaction, interactionReplyPayload);

    const { stream } = await streamFromYtLink(nextItem.url, {
      discordPlayerCompatibility: true,
    });
    const resource = createAudioResource(stream);
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
