import { Injectable, Logger } from '@nestjs/common';
import { ButtonInteraction, ChatInputCommandInteraction, EmbedBuilder, GuildMember } from 'discord.js';
import { getVoiceConnection } from '@discordjs/voice';

import { YoutubeService } from 'src/youtube/youtube.service';
import { PlayQueueService } from 'src/play.queue/play.queue.service';
import { DiscordAudioService } from 'src/discord/discord.audio.service';
import { DiscordPlayerMessageService } from 'src/discord/discord.player.message.service';
import { INTERACTION_REPLY_TIMEOUT } from 'src/discord/constants';

@Injectable()
export class DiscordInteractionService {
  private readonly logger = new Logger(DiscordInteractionService.name);

  constructor(
    private readonly youtubeService: YoutubeService,
    private readonly playQueueService: PlayQueueService,
    private readonly discordAudioService: DiscordAudioService,
    private readonly discordPlayerMessageService: DiscordPlayerMessageService,
  ) {}

  public async handlePlayCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const userInput = interaction.options.getString('link');

    if (!(interaction.member as GuildMember).voice.channel) {
      await interaction.reply('⛔ You must be in a voice channel to use this command');
      return;
    }

    const { isValid, isVideo, isPlaylist } = this.youtubeService.validateAndGetLinkInfo(userInput);

    if (!isValid) {
      await interaction.reply('⛔ Invalid link');
      return;
    }

    await this.discordPlayerMessageService.editOrCreate(interaction, 'Loading details...');

    const hasItemsInQueue = Boolean(await this.playQueueService.getQueue(interaction.guild.id));

    if (hasItemsInQueue && !isPlaylist) {
      await this.pushSingleItemToQueue({ interaction, mediaUrl: userInput });
    }

    if (!hasItemsInQueue && isVideo) {
      await this.playMedia({ interaction, mediaUrl: userInput, pushToQueue: true });
    }

    if (isPlaylist) {
      await this.pushPlaylistToQueue({
        interaction,
        playlistUrl: userInput,
      });
      if (!hasItemsInQueue) {
        this.playMedia({
          interaction,
          mediaUrl: userInput,
          pushToQueue: false,
        });
      }
    }
  }

  public disconnectVoiceChannel(interaction: ButtonInteraction): void {
    const connection = getVoiceConnection(interaction.guild.id);
    connection?.destroy();
    interaction.reply('Disconnected');
    this.playQueueService.destroyQueue(interaction.guild.id);
    this.discordPlayerMessageService.delete(interaction.guild.id);
  }

  private async pushSingleItemToQueue({
    interaction,
    mediaUrl,
  }: {
    interaction: ChatInputCommandInteraction;
    mediaUrl: string;
  }): Promise<void> {
    await this.playQueueService.pushToQueue({
      guildId: interaction.guild.id,
      urls: mediaUrl,
    });
    const { title } = await this.youtubeService.getVideoInfo(mediaUrl);
    this.displaySuccessMessage({ interaction, successMessage: `Added to queue: **${title}**`, editPrevReply: false });

    const interactionReplyPayload = await this.discordPlayerMessageService.getPlayerMessagePayload(
      interaction.guild.id,
    );
    await this.discordPlayerMessageService.editOrCreate(interaction, interactionReplyPayload);
    return;
  }

  private async playMedia({
    interaction,
    mediaUrl,
    pushToQueue,
  }: {
    interaction: ChatInputCommandInteraction;
    mediaUrl: string;
    pushToQueue: boolean;
  }): Promise<void> {
    if (pushToQueue) {
      await this.playQueueService.pushToQueue({
        guildId: interaction.guild.id,
        urls: mediaUrl,
      });
    }

    const onSuccess = async () => {
      const interactionReplyPayload = await this.discordPlayerMessageService.getPlayerMessagePayload(
        interaction.guild.id,
      );
      await this.discordPlayerMessageService.editOrCreate(interaction, interactionReplyPayload);
    };

    await this.discordAudioService.playAudio(interaction, onSuccess);
  }

  private async pushPlaylistToQueue({
    interaction,
    playlistUrl,
  }: {
    interaction: ChatInputCommandInteraction;
    playlistUrl: string;
  }): Promise<void> {
    await interaction.reply('Loading details...');

    const { videosUrls, playlistTitle } = await this.youtubeService.getPlaylistInfo(playlistUrl);
    await this.playQueueService.pushToQueue({
      urls: videosUrls,
      guildId: interaction.guild.id,
    });

    this.displaySuccessMessage({
      interaction,
      successMessage: `Added **${videosUrls.length}** items from **${playlistTitle}** to queue`,
      editPrevReply: true,
    });
  }

  private async displaySuccessMessage({
    interaction,
    successMessage,
    editPrevReply = true,
  }: {
    interaction: ChatInputCommandInteraction;
    successMessage: string;
    editPrevReply?: boolean;
  }): Promise<void> {
    const addedToQueueEmbedMessage = new EmbedBuilder().setColor(0x57f287).setDescription(successMessage);
    const payload = {
      embeds: [addedToQueueEmbedMessage],
    };

    try {
      const message = editPrevReply ? await interaction.editReply(payload) : await interaction.reply(payload);
      setTimeout(() => {
        message.delete();
      }, INTERACTION_REPLY_TIMEOUT);
    } catch (error) {
      this.logger.error('Failed to send message', error);
    }
  }
}
