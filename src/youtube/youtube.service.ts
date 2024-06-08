import { Injectable, Logger } from '@nestjs/common';
import { EmbedBuilder } from 'discord.js';

import {
  yt_validate as validateYtURL,
  video_info as getVideoInfo,
  playlist_info as getPlaylistInfo,
  YouTubeVideo,
} from 'play-dl';

@Injectable()
export class YoutubeService {
  private readonly logger = new Logger(YoutubeService.name);

  public formatDuration(seconds: number): string {
    // Convert seconds to integer in case it's a float
    const floorSeconds = Math.floor(Number(seconds));

    const hours = Math.floor(floorSeconds / 3600);
    const minutes = Math.floor((floorSeconds % 3600) / 60);
    const remainingSeconds = floorSeconds % 60;

    // Use string padding for consistent two-digit format
    const formattedHours = hours.toString().padStart(2, '0');
    const formattedMinutes = minutes.toString().padStart(2, '0');
    const formattedSeconds = remainingSeconds.toString().padStart(2, '0');

    if (!Number(hours)) {
      return `${formattedMinutes}:${formattedSeconds}`;
    }

    return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
  }

  public validateAndGetLinkInfo(input: string): {
    isValid: boolean;
    isVideo: boolean;
    isPlaylist: boolean;
  } {
    const formattedInput = (
      input.includes('music.') ? input : input.replaceAll('music.', '')
    ).trim();
    const linkInfo = validateYtURL(formattedInput);

    const isVideo = linkInfo === 'video';
    const isPlaylist = linkInfo === 'playlist';
    const isValid = isVideo || isPlaylist;

    return {
      isValid,
      isVideo,
      isPlaylist,
    };
  }

  public async getEmbedVideoInfoForDiscord(
    videoUrl: string,
  ): Promise<EmbedBuilder> {
    const videoInfo = await this.getVideoInfo(videoUrl);
    if (!videoInfo) {
      return new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('Failed to get video info');
    }

    const thumbnail = videoInfo.thumbnails.at(-1).url;
    const authorThumbnail = videoInfo.channel.icons.at(-1).url;
    const name = videoInfo.channel.name.includes(' - Topic')
      ? videoInfo.channel.name.replace(' - Topic', '')
      : videoInfo.channel.name;

    return new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(
        `${videoInfo.title}  ▶︎ ${this.formatDuration(videoInfo.durationInSec)} •၊၊||။‌‌‌‌‌၊|•`,
      )
      .setURL(videoInfo.url)
      .setAuthor({
        name,
        iconURL: authorThumbnail,
        url: videoInfo.channel.url,
      })
      .setThumbnail(thumbnail);
  }

  public async getVideoInfo(videoUrl: string): Promise<YouTubeVideo | null> {
    try {
      const { video_details: videoInfo } = await getVideoInfo(videoUrl);
      return videoInfo;
    } catch (e) {
      this.logger.error(`Failed to the video info: ${videoUrl}`, e);
      return null;
    }
  }

  /**
   * @returns the list of video URLs from the playlist
   */
  public async getPlaylistInfo(playlistUrl: string): Promise<string[]> {
    const { all_videos } = await getPlaylistInfo(playlistUrl, {
      incomplete: true,
    });
    const allVideosFromPlaylist = await all_videos();

    return allVideosFromPlaylist.map(({ url }) => url);
  }
}
