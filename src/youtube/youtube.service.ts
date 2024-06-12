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
    currentlyPlayingVideoUrl: string,
    nextVideoUrl: string | undefined,
  ): Promise<EmbedBuilder> {
    const currentlyPlayingVideoInfo = await this.getVideoInfo(
      currentlyPlayingVideoUrl,
    );
    const nextVideoInfo = nextVideoUrl
      ? await this.getVideoInfo(nextVideoUrl)
      : null;
    if (!currentlyPlayingVideoInfo) {
      return new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('Failed to get video info');
    }

    const thumbnail = currentlyPlayingVideoInfo.thumbnails.at(-1).url;
    const authorThumbnail = currentlyPlayingVideoInfo.channel.icons.at(-1).url;
    const name = currentlyPlayingVideoInfo.channel.name.includes(' - Topic')
      ? currentlyPlayingVideoInfo.channel.name.replace(' - Topic', '')
      : currentlyPlayingVideoInfo.channel.name;

    const payload = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(
        `${currentlyPlayingVideoInfo.title}  ▶︎ ${this.formatDuration(currentlyPlayingVideoInfo.durationInSec)} •၊၊||။‌‌‌‌‌၊|•`,
      )
      .setURL(currentlyPlayingVideoInfo.url)
      .setAuthor({
        name,
        iconURL: authorThumbnail,
        url: currentlyPlayingVideoInfo.channel.url,
      })
      .setThumbnail(thumbnail);

    if (nextVideoInfo) {
      payload.setDescription(`Next  •  **${nextVideoInfo.title}**`);
    }

    return payload;
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
  public async getPlaylistInfo(
    playlistUrl: string,
  ): Promise<{ videosUrls: string[]; playlistTitle: string }> {
    const { all_videos, title } = await getPlaylistInfo(playlistUrl, {
      incomplete: true,
    });
    const allVideosFromPlaylist = await all_videos();

    const videosUrls = allVideosFromPlaylist.map(({ url }) => url);

    return { videosUrls, playlistTitle: title };
  }
}
