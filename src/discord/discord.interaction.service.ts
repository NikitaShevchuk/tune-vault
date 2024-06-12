import { Injectable, Logger } from '@nestjs/common';
import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
} from 'discord.js';

import { YoutubeService } from 'src/youtube/youtube.service';
import { PlayQueueService } from 'src/play.queue/play.queue.service';
import { DiscordAudioService } from 'src/discord/discord.audio.service';
import { DiscordPlayerMessageService } from 'src/discord/discord.player.message.service';

@Injectable()
export class DiscordInteractionService {
  private readonly logger = new Logger(DiscordInteractionService.name);

  constructor(
    private readonly youtubeService: YoutubeService,
    private readonly playQueueService: PlayQueueService,
    private readonly discordAudioService: DiscordAudioService,
    private readonly discordPlayerMessageService: DiscordPlayerMessageService,
  ) {}

  public async handlePlayCommand(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const userInput = interaction.options.getString('link');

    if (!(interaction.member as GuildMember).voice.channel) {
      await interaction.reply(
        '⛔ You must be in a voice channel to use this command',
      );
      return;
    }

    const { isValid, isVideo, isPlaylist } =
      this.youtubeService.validateAndGetLinkInfo(userInput);

    if (!isValid) {
      await interaction.reply('⛔ Invalid link');
      return;
    }

    const hasItemsInQueue = Boolean(
      await this.playQueueService.getQueue(interaction.guild.id),
    );

    if (hasItemsInQueue && !isPlaylist) {
      await this.pushSingleItemToQueue({ interaction, mediaUrl: userInput });
    }

    if (!hasItemsInQueue && isVideo) {
      this.playMedia({ interaction, mediaUrl: userInput, pushToQueue: true });
    }

    if (isPlaylist) {
      this.pushPlaylistToQueue({
        interaction,
        playlistUrl: userInput,
        replyToInteraction: false,
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
    const forceReply = true;
    this.displaySuccessMessage(
      interaction,
      `Added to queue: **${title}**`,
      forceReply,
    );

    const interactionReplyPayload =
      await this.discordPlayerMessageService.getPlayerMessagePayload(
        interaction.guild.id,
      );
    await this.discordPlayerMessageService.editOrCreate(
      interaction,
      interactionReplyPayload,
    );
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
        markAsPlayedByDefault: true,
      });
    }
    this.discordAudioService.playAudio(interaction);

    await this.discordPlayerMessageService.editOrCreate(
      interaction,
      'Loading details...',
    );

    const interactionReplyPayload =
      await this.discordPlayerMessageService.getPlayerMessagePayload(
        interaction.guild.id,
      );

    await this.discordPlayerMessageService.editOrCreate(
      interaction,
      interactionReplyPayload,
    );
  }

  private async pushPlaylistToQueue({
    interaction,
    playlistUrl,
    replyToInteraction,
  }: {
    interaction: ChatInputCommandInteraction;
    playlistUrl: string;
    replyToInteraction: boolean;
  }): Promise<void> {
    const { videosUrls, playlistTitle } =
      await this.youtubeService.getPlaylistInfo(playlistUrl);
    this.playQueueService.pushToQueue({
      urls: videosUrls,
      guildId: interaction.guild.id,
    });

    if (replyToInteraction) {
      const forceReply = true;
      this.displaySuccessMessage(
        interaction,
        `Added **${videosUrls.length}** items from **${playlistTitle}** to queue`,
        forceReply,
      );
    }
  }

  private async displaySuccessMessage(
    interaction: ChatInputCommandInteraction,
    successBody: string,
    forceReply = false,
  ): Promise<void> {
    const addedToQueueEmbedMessage = new EmbedBuilder()
      .setColor(0x57f287)
      .setDescription(successBody);

    const payload = {
      embeds: [addedToQueueEmbedMessage],
    };

    const message = forceReply
      ? await interaction.reply(payload)
      : await this.discordPlayerMessageService.editOrCreate(
          interaction,
          payload,
        );

    setTimeout(() => {
      message.delete();
    }, 5_000);
  }
}
