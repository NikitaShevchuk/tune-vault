import { Interaction, MessageCreateOptions, MessagePayload } from 'discord.js';

export type InteractionOrUserId<I = Interaction> =
  | { interaction: I; userId: undefined | string }
  | { userId: string; interaction: undefined | I };

export type ReplyPayload<I = Interaction> = InteractionOrUserId<I> & {
  message: MessagePayload | MessageCreateOptions | string;
};
