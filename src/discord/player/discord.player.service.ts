import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AudioPlayerStatus } from '@discordjs/voice';
import { ChatInputCommandInteraction, GuildMember, MessagePayload } from 'discord.js';

import { DiscordAudioService } from '../discord.audio.service';
import { PlayerEvents } from './actions';
import { DiscordPlayerState, InteractionOrGuildId, InteractionOrUserId } from '../types';
import { PlayQueueService } from 'src/play.queue/play.queue.service';
import { YoutubeService } from 'src/youtube/youtube.service';
import { DiscordGuildService } from '../discord.guild.service';
import { InvalidLinkError, InvalidPlayerActionError, NotVoiceChannelMemberError } from '../exceptions';

@Injectable()
export class DiscordPlayerService {
  private readonly logger = new Logger(DiscordPlayerService.name);

  constructor(
    private readonly discordAudioService: DiscordAudioService,
    private readonly youtubeService: YoutubeService,
    private readonly playQueueService: PlayQueueService,
    private readonly discordGuildService: DiscordGuildService,
  ) {}

  public async getCurrentPlayerState(guildId: string): Promise<DiscordPlayerState> {
    const currentVideo = await this.playQueueService.getCurrentItem(guildId);
    const nextVideo = await this.playQueueService.getNextItem({
      guildId,
      markCurrentAsPlayed: false,
    });

    const currentVideoDetails = currentVideo?.url ? await this.youtubeService.getVideoInfo(currentVideo?.url) : null;
    const nextVideoDetails = nextVideo?.url ? await this.youtubeService.getVideoInfo(nextVideo?.url) : null;
    const guildPlayer = this.discordAudioService.getCurrentPlayerStateByGuildId(guildId);
    const isPaused = guildPlayer?.status === AudioPlayerStatus.Paused;

    return {
      isPaused,
      currentTrack: currentVideoDetails,
      nextTrack: nextVideoDetails,
    };
  }

  public async playFromHttp({
    userInput,
    userId,
  }: {
    userInput: string;
    userId: string;
  }): Promise<MessagePayload | string | null> {
    try {
      return await this.play({ userInput, userId, interaction: undefined });
    } catch (e) {
      if (e instanceof InvalidLinkError) {
        throw new BadRequestException(e.message);
      }

      // TODO: Add sentry logging
      this.logger.error(e);
      throw new ServiceUnavailableException(e.message);
    }
  }

  public async playFromInteraction(interaction: ChatInputCommandInteraction): Promise<MessagePayload | string | null> {
    const userInput = interaction.options.getString('link');

    if (!(interaction.member as GuildMember).voice.channel) {
      throw new NotVoiceChannelMemberError();
    }

    return await this.play({ interaction, userInput, userId: interaction.user.id });
  }

  /**
   * Action must be one of PlayerEvents
   */
  public async changePlayerState({
    action,
    guildId,
  }: {
    action: string;
    guildId: string;
  }): Promise<MessagePayload | string> {
    if (action === PlayerEvents.PLAY_PREV) {
      return await this.discordAudioService.playPrevTrack(guildId);
    }
    if (action === PlayerEvents.PLAY_NEXT) {
      const message = await this.discordAudioService.playNextTrack(guildId);

      return message || 'Playing next track';
    }
    if (action === PlayerEvents.PAUSE_OR_PLAY) {
      return await this.discordAudioService.pauseOrPlayAudio(guildId);
    }

    if (action === PlayerEvents.DISCONNECT_BOT) {
      return await this.discordAudioService.disconnectFromVoiceChannel(guildId);
    }

    throw new InvalidPlayerActionError();
  }

  /**
   * Plays a track or a playlist from a given URL
   * Either an interaction or a user ID must be provided
   */
  public async play({
    userInput: url,
    interaction,
    userId,
  }: { userInput: string } & InteractionOrUserId): Promise<MessagePayload | string | null> {
    const { isValid, isPlaylist, isYouTubeLink } = this.youtubeService.validateAndGetLinkInfo(url);

    if (isYouTubeLink && !isValid) {
      throw new InvalidLinkError();
    }

    const guildId = await this.discordGuildService.getActiveGuildId({ interaction, userId });
    const hasItemsInQueue = Boolean((await this.playQueueService.getOrCreatePlayQueue(guildId)).queue.length);

    if (isPlaylist) {
      const message = await this.pushPlaylistToQueue({ guildId, playlistUrl: url });
      if (!hasItemsInQueue) {
        await this.discordAudioService.startAudio({ interaction, guildId, userId });
      }
      return message;
    }

    if (isYouTubeLink) {
      return await this.pushToQueueAndPlayIfQueueWasEmpty({
        hasItemsInQueue,
        mediaUrl: url,
        interaction,
        guildId,
        userId,
      });
    }

    const searchResult = await this.youtubeService.search(url);
    if (!searchResult) {
      return '⛔ No results found';
    }

    return await this.pushToQueueAndPlayIfQueueWasEmpty({
      hasItemsInQueue,
      mediaUrl: searchResult.url,
      guildId,
      interaction,
      userId,
    });
  }

  private async pushToQueueAndPlayIfQueueWasEmpty({
    hasItemsInQueue,
    mediaUrl,
    guildId,
    interaction,
    userId,
  }: InteractionOrGuildId &
    InteractionOrUserId & {
      hasItemsInQueue: boolean;
      mediaUrl: string;
    }): Promise<MessagePayload | string> {
    if (hasItemsInQueue) {
      return await this.pushSingleItemToQueue({ mediaUrl, guildId });
    }

    await this.playQueueService.pushToQueue({
      guildId,
      urls: mediaUrl,
    });

    await this.discordAudioService.startAudio({
      interaction,
      guildId,
      userId,
    });
  }

  private async pushSingleItemToQueue({
    guildId,
    mediaUrl,
  }: {
    mediaUrl: string;
    guildId: string;
  }): Promise<MessagePayload | string> {
    await this.playQueueService.pushToQueue({
      guildId,
      urls: mediaUrl,
    });

    try {
      const { title } = await this.youtubeService.getVideoInfo(mediaUrl);
      return `Added to queue: **${title}**`;
    } catch (e) {
      // TODO add sentry logging
      this.logger.error('Failed to get video details', e);
      return 'Unknown';
    }
  }

  private async pushPlaylistToQueue({
    playlistUrl,
    guildId,
  }: {
    playlistUrl: string;
    guildId: string;
  }): Promise<MessagePayload | string | null> {
    const playlistInfo = await this.youtubeService.getPlaylistInfo(playlistUrl);
    if (!playlistInfo) {
      return;
    }

    const { videosUrls, playlistTitle } = playlistInfo;
    await this.playQueueService.pushToQueue({ urls: videosUrls, guildId });

    return `Added **${videosUrls.length}** items from **${playlistTitle}** to queue`;
  }
}
