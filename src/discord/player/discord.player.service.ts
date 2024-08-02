import { Injectable, Logger } from '@nestjs/common';
import { DiscordAudioService } from '../discord.audio.service';
import { PlayerEvents } from './actions';
import { InteractionOrUserId } from '../types';
import { ButtonInteraction, ChatInputCommandInteraction } from 'discord.js';
import { PlayQueueService } from 'src/play.queue/play.queue.service';
import { YoutubeService } from 'src/youtube/youtube.service';
import { DiscordGuildService } from '../discord.guild.service';
import { DiscordMessageService } from '../discord.message.service';
import { DiscordPlayerMessageService } from './discord.player.message.service';

@Injectable()
export class DiscordPlayerService {
  private readonly logger = new Logger(DiscordPlayerService.name);

  constructor(
    private readonly discordAudioService: DiscordAudioService,
    private readonly youtubeService: YoutubeService,
    private readonly playQueueService: PlayQueueService,
    private readonly discordPlayerMessageService: DiscordPlayerMessageService,
    private readonly discordMessageService: DiscordMessageService,
    private readonly discordGuildService: DiscordGuildService,
  ) {}

  public async playFromHttp({ url, userId }: { url: string; userId: string }): Promise<void> {
    this.play({ url, userId, interaction: undefined });
  }

  /**
   * Action must be one of PlayerActions
   */
  public async changePlayerState({
    userId,
    interaction,
    action,
  }: { action: string } & InteractionOrUserId<ButtonInteraction>): Promise<void> {
    if (action === PlayerEvents.PLAY_PREV) {
      await this.discordAudioService.playPrevTrack({ interaction, userId });
    }
    if (action === PlayerEvents.PLAY_NEXT) {
      this.discordAudioService.playNextTrack({
        interaction,
        stopCurrent: true,
        replyToInteraction: true,
        userId,
      });
    }
    if (action === PlayerEvents.PAUSE_OR_PLAY) {
      this.discordAudioService.pauseOrPlayAudio({ interaction, userId });
    }
    if (action === PlayerEvents.DISCONNECT_BOT) {
      this.discordAudioService.disconnectFromVoiceChannel({ interaction, userId });
    }
  }

  /**
   * Plays a track or a playlist from a given URL
   * Either an interaction or a user ID must be provided
   */
  public async play({
    url,
    ...interactionOrUserId
  }: { url: string } & InteractionOrUserId<ChatInputCommandInteraction>): Promise<void> {
    const { isValid, isPlaylist, isYouTubeLink } = this.youtubeService.validateAndGetLinkInfo(url);
    const { interaction, userId } = interactionOrUserId;

    if (isYouTubeLink && !isValid) {
      await this.discordMessageService.replyAndDeleteAfterDelay({
        message: '⛔ Invalid link',
        ...interactionOrUserId,
      });
      return;
    }

    await this.discordPlayerMessageService.editOrReply({
      message: 'Loading details...',
      ...interactionOrUserId,
    });

    const guildId = await this.discordGuildService.getActiveGuildId({ interaction, userId });
    const hasItemsInQueue = Boolean((await this.playQueueService.getOrCreatePlayQueue(guildId)).queue.length);

    if (isPlaylist) {
      await this.pushPlaylistToQueue({
        playlistUrl: url,
        hasItemsInQueue,
        ...interactionOrUserId,
      });
      if (!hasItemsInQueue) {
        await this.discordAudioService.startAudio({
          onSuccess: () => this.discordPlayerMessageService.sendCurrentTrackDetails(interactionOrUserId),
          ...interactionOrUserId,
        });
      }
      return;
    }

    if (isYouTubeLink) {
      this.pushToQueueAndPlayIfQueueWasEmpty({
        hasItemsInQueue,
        mediaUrl: url,
        ...interactionOrUserId,
      });

      return;
    }

    const searchResult = await this.youtubeService.search(url);
    if (!searchResult) {
      await this.discordMessageService.replyAndDeleteAfterDelay({
        message: '⛔ No results found',
        ...interactionOrUserId,
      });
      return;
    }

    this.pushToQueueAndPlayIfQueueWasEmpty({
      hasItemsInQueue,
      mediaUrl: searchResult.url,
      ...interactionOrUserId,
    });
  }

  private async pushToQueueAndPlayIfQueueWasEmpty({
    hasItemsInQueue,
    interaction,
    mediaUrl,
    userId,
  }: {
    hasItemsInQueue: boolean;
    mediaUrl: string;
  } & InteractionOrUserId<ChatInputCommandInteraction>): Promise<void> {
    if (hasItemsInQueue) {
      await this.pushSingleItemToQueue({ interaction, mediaUrl, userId });
      return;
    }
    const guildId = await this.discordGuildService.getActiveGuildId({ userId, interaction });
    await this.playQueueService.pushToQueue({
      guildId,
      urls: mediaUrl,
    });
    await this.discordAudioService.startAudio({
      interaction,
      userId,
      onSuccess: () => this.discordPlayerMessageService.sendCurrentTrackDetails({ interaction, userId }),
    });
    return;
  }

  private async pushSingleItemToQueue({
    interaction,
    userId,
    mediaUrl,
  }: {
    mediaUrl: string;
  } & InteractionOrUserId<ChatInputCommandInteraction>): Promise<void> {
    const guildId = await this.discordGuildService.getActiveGuildId({ userId, interaction });
    await this.playQueueService.pushToQueue({
      guildId,
      urls: mediaUrl,
    });
    const { title } = await this.youtubeService.getVideoInfo(mediaUrl);
    this.discordMessageService.displaySuccessMessage({
      interaction,
      successMessage: `Added to queue: **${title}**`,
      userId,
    });

    await this.discordPlayerMessageService.sendCurrentTrackDetails({ interaction, userId });
    return;
  }

  private async pushPlaylistToQueue({
    playlistUrl,
    hasItemsInQueue,
    interaction,
    userId,
  }: {
    playlistUrl: string;
    hasItemsInQueue: boolean;
  } & InteractionOrUserId<ChatInputCommandInteraction>): Promise<void> {
    if (hasItemsInQueue) {
      try {
        if (!interaction) {
          const activeChannel = await this.discordGuildService.getActiveTextChannel(userId);
          await activeChannel.send('Loading playlist details...');
        } else {
          await interaction.reply('Loading playlist details...');
        }
      } catch (e) {
        this.logger.error('Failed to reply to an interaction', e);
      }
    } else {
      await this.discordPlayerMessageService.editOrReply({
        interaction,
        userId,
        message: 'Loading playlist details...',
      });
    }

    const playlistInfo = await this.youtubeService.getPlaylistInfo(playlistUrl);
    if (!playlistInfo) {
      return;
    }
    const { videosUrls, playlistTitle } = playlistInfo;

    const guildId = await this.discordGuildService.getActiveGuildId({ userId, interaction });
    await this.playQueueService.pushToQueue({ urls: videosUrls, guildId });

    await this.discordMessageService.displaySuccessMessage({
      interaction,
      successMessage: `Added **${videosUrls.length}** items from **${playlistTitle}** to queue`,
      shouldDeleteAfterDelay: hasItemsInQueue,
      userId,
    });
  }
}
