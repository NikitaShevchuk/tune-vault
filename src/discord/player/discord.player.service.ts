import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AudioPlayerStatus } from '@discordjs/voice';
import { ChatInputCommandInteraction, GuildMember, MessagePayload } from 'discord.js';

import { DiscordAudioService } from '../discord.audio.service';
import { PlayerEvents } from './actions';
import { DiscordPlayerState, InteractionOrUserId } from '../types';
import { PlayQueueService } from 'src/play.queue/play.queue.service';
import { YoutubeService } from 'src/youtube/youtube.service';
import { DiscordGuildService } from '../discord.guild.service';
import {
  InvalidLinkError,
  InvalidPlayerActionError,
  NotVoiceChannelMemberError,
  UnknownSourceError,
} from '../exceptions';

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
    const [currentVideo, nextVideo] = await Promise.all([
      this.playQueueService.getCurrentItem(guildId),
      this.playQueueService.getNextItem({
        guildId,
        markCurrentAsPlayed: false,
      }),
    ]);

    const [currentVideoDetails, nextVideoDetails] = await Promise.all([
      currentVideo?.url ? this.youtubeService.getVideoInfo(currentVideo?.url) : null,
      nextVideo?.url ? this.youtubeService.getVideoInfo(nextVideo?.url) : null,
    ]);

    const guildPlayer = this.discordAudioService.getCurrentPlayerStateByGuildId(guildId);
    const isPaused = guildPlayer?.status === AudioPlayerStatus.Paused;

    return {
      isPaused,
      currentTrack: currentVideoDetails,
      nextTrack: nextVideoDetails,
    };
  }

  public async playFromHttp({ userInput, userId }: { userInput: string; userId: string }): Promise<string | null> {
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

  public async playFromInteraction(interaction: ChatInputCommandInteraction): Promise<string | null> {
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
  private async play({
    userInput,
    interaction,
    userId,
  }: { userInput: string } & InteractionOrUserId): Promise<string | null> {
    const initialValidationResult = this.youtubeService.validateAndGetLinkInfo(userInput);
    const { isValid, isPlaylist, isTrackLink } = initialValidationResult;

    if ((isTrackLink || isPlaylist) && !isValid) {
      throw new InvalidLinkError();
    }

    const guildId = await this.discordGuildService.getActiveGuildId({ interaction, userId });

    if (isTrackLink || isPlaylist) {
      return await this.playFromValidatedSource({
        mediaUrl: userInput,
        userId,
        guildId,
        interaction,
        validationResult: initialValidationResult,
      });
    }

    return await this.handleSearch({ userInput, interaction, userId, guildId });
  }

  private async handleSearch({
    userInput,
    interaction,
    guildId,
    userId,
  }: {
    userInput: string;
    guildId: string;
  } & InteractionOrUserId): Promise<string> {
    const searchResult = await this.youtubeService.search(userInput);

    if (!searchResult) {
      return '⛔ No results found';
    }

    const { url } = searchResult;
    const searchResultValidationResult = this.youtubeService.validateAndGetLinkInfo(url);
    return await this.playFromValidatedSource({
      mediaUrl: url,
      userId,
      guildId,
      interaction,
      validationResult: searchResultValidationResult,
    });
  }

  private async playFromValidatedSource({
    mediaUrl,
    interaction,
    guildId,
    userId,
    validationResult: { isPlaylist, isTrackLink },
  }: {
    mediaUrl: string;
    guildId: string;
    validationResult: ReturnType<YoutubeService['validateAndGetLinkInfo']>;
  } & InteractionOrUserId): Promise<string> {
    const hadItemsInTheQueuePreviosly = await this.playQueueService.hasItemsInTheQueue(guildId);
    let message: string | null = null;

    if (isTrackLink) {
      message = await this.pushTrackLinkToQueueAndGetMessage({ mediaUrl, guildId });
    } else if (isPlaylist) {
      message = await this.pushPlaylistToQueueAndGetMessage({ mediaUrl, guildId });
    } else {
      throw new UnknownSourceError();
    }

    if (!hadItemsInTheQueuePreviosly) {
      await this.discordAudioService.startAudio({ interaction, guildId, userId, sourceUrl: mediaUrl });
    }

    return message;
  }

  private async pushTrackLinkToQueueAndGetMessage({
    guildId,
    mediaUrl,
  }: {
    mediaUrl: string;
    guildId: string;
  }): Promise<string> {
    await this.playQueueService.pushToQueue({ guildId, urls: mediaUrl });
    const { title } = await this.youtubeService.getVideoInfo(mediaUrl);
    return `Added to queue: **${title}**`;
  }

  private async pushPlaylistToQueueAndGetMessage({
    guildId,
    mediaUrl,
  }: {
    mediaUrl: string;
    guildId: string;
  }): Promise<string> {
    const { videosUrls, playlistTitle } = await this.youtubeService.getPlaylistInfo(mediaUrl);
    await this.playQueueService.pushToQueue({ urls: videosUrls, guildId });
    return `Added **${videosUrls.length}** items from **${playlistTitle}** to queue`;
  }
}
