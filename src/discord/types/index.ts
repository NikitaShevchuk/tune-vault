import { ButtonInteraction, CommandInteraction, MessageCreateOptions, MessagePayload } from 'discord.js';

import { TrackDetails } from 'src/youtube/types';

export type InteractionOrUserId<I = CommandInteraction | ButtonInteraction> =
  | { interaction: I; userId: undefined | string }
  | { userId: string; interaction: undefined | I };

export type InteractionOrGuildId<I = CommandInteraction | ButtonInteraction> =
  | { interaction: I; guildId: undefined | string }
  | { guildId: string; interaction: undefined | I };

export type ReplyPayload = {
  message: MessagePayload | MessageCreateOptions | string;
  guildId: string;
} & (
  | { interaction: CommandInteraction | ButtonInteraction; guildId: undefined | string }
  | { guildId: string; interaction: undefined | CommandInteraction | ButtonInteraction }
);

export interface DiscordPlayerState {
  currentTrack: TrackDetails | null;
  nextTrack: TrackDetails | null;
  isPaused: boolean;
}
