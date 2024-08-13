import { Injectable, Logger } from '@nestjs/common';
import {
  yt_validate as validateYtURL,
  video_info as getVideoInfo,
  playlist_info as getPlaylistInfo,
  YouTubeVideo,
  search as ytSearch,
} from 'play-dl';

import { TrackDetails } from 'src/youtube/types';

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
    isYouTubeLink: boolean;
  } {
    const formattedInput = (input.includes('music.') ? input : input.replaceAll('music.', '')).trim();
    const linkInfo = validateYtURL(formattedInput);

    const isVideo = linkInfo === 'video';
    const isPlaylist = linkInfo === 'playlist';
    const isValid = isVideo || isPlaylist;
    const isYouTubeLink = input?.includes('youtube.com');

    return {
      isValid,
      isVideo,
      isPlaylist,
      isYouTubeLink,
    };
  }

  /**
   * Uses an external library and makes a request to it may throw an exception
   */
  public async getVideoInfo(videoUrl: string): Promise<TrackDetails> {
    const { video_details } = await getVideoInfo(videoUrl);
    const { title, url, channel, thumbnails, durationInSec } = video_details;

    const thumbnail = thumbnails.at(-1).url;
    const authorThumbnail = channel.icons.at(-1).url;
    const authorName = channel.name.includes(' - Topic') ? channel.name.replace(' - Topic', '') : channel.name;
    const authorUrl = channel.url;
    const formattedDuration = this.formatDuration(durationInSec);

    return {
      authorThumbnail,
      title,
      url,
      thumbnail,
      authorName,
      authorUrl,
      formattedDuration,
    };
  }

  public async getPlaylistInfo(playlistUrl: string): Promise<{ videosUrls: string[]; playlistTitle: string } | null> {
    try {
      const playlist = await getPlaylistInfo(playlistUrl, {
        incomplete: true,
      });

      const allVideosFromPlaylist = await playlist.all_videos();

      const videosUrls = allVideosFromPlaylist.map(({ url }) => url);

      return { videosUrls, playlistTitle: playlist.title };
    } catch (e) {
      this.logger.error('Failed to get playlist info', e);
      return null;
    }
  }

  public async search(query: string): Promise<YouTubeVideo | null> {
    try {
      const results = await ytSearch(query, { limit: 1 });
      return results?.[0] ?? null;
    } catch (e) {
      this.logger.error(`Failed to search for: ${query}`, e);
      return null;
    }
  }
}
