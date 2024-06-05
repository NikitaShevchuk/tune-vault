import { Injectable } from '@nestjs/common';
import { yt_validate as validateYtURL } from 'play-dl';

@Injectable()
export class DiscordHelperService {
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

  public validateUserInput(input: string): boolean {
    if (input.includes('music.')) {
      return Boolean(validateYtURL(input.replaceAll('music.', '')));
    }

    return Boolean(validateYtURL(input));
  }
}
