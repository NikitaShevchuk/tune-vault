import { Injectable, Logger } from '@nestjs/common';
import { ButtonInteraction, ChatInputCommandInteraction, EmbedBuilder, InteractionReplyOptions } from 'discord.js';

import { INTERACTION_REPLY_TIMEOUT_MS } from 'src/discord/constants';

@Injectable()
export class DiscordInteractionHelperService {
  private readonly logger = new Logger(DiscordInteractionHelperService.name);

  public async displaySuccessMessage({
    interaction,
    successMessage,
    editPrevReply = true,
    shouldDeleteAfterDelay = true,
  }: {
    interaction: ChatInputCommandInteraction;
    successMessage: string;
    editPrevReply?: boolean;
    shouldDeleteAfterDelay?: boolean;
  }): Promise<void> {
    const addedToQueueEmbedMessage = new EmbedBuilder().setColor(0x57f287).setDescription(successMessage);
    const payload = {
      embeds: [addedToQueueEmbedMessage],
    };

    try {
      const message = editPrevReply ? await interaction.editReply(payload) : await interaction.reply(payload);
      if (shouldDeleteAfterDelay) {
        setTimeout(() => {
          message.delete();
        }, INTERACTION_REPLY_TIMEOUT_MS);
      }
    } catch (error) {
      this.logger.error('Failed to send message', error);
    }
  }

  public async replyAndDeleteAfterDelay({
    interaction,
    message,
    delayMs = INTERACTION_REPLY_TIMEOUT_MS,
  }: {
    interaction: ChatInputCommandInteraction | ButtonInteraction;
    message: string | InteractionReplyOptions;
    delayMs?: number;
  }): Promise<void> {
    await interaction.reply(message);
    setTimeout(interaction.deleteReply, delayMs);
  }
}
