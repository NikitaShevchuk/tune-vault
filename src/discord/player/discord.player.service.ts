import { Injectable } from '@nestjs/common';
import { DiscordAudioService } from '../discord.audio.service';
import { PlayerActions } from './actions';

@Injectable()
export class DiscordPlayerService {
  constructor(private readonly discordAudioService: DiscordAudioService) {}

  /**
   * Action must be one of PlayerActions
   */
  public async changePlayerState(action: string): Promise<void> {
    if (action === PlayerActions.PLAY_PREV) {
      this.discordAudioService.playPrevTrack(interaction);
    }
    if (action === PlayerActions.PAUSE_OR_PLAY) {
      this.discordAudioService.pauseOrPlayAudio(interaction);
    }
    if (action === PlayerActions.PLAY_NEXT) {
      this.discordAudioService.playNextTrack({
        interaction,
        stopCurrent: true,
        replyToInteraction: true,
        userId: undefined,
      });
    }
    if (action === PlayerActions.DISCONNECT_BOT) {
      this.discordAudioService.disconnectFromVoiceChannel({ interaction, userId: undefined });
    }
  }
}
