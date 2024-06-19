import { Injectable, Logger } from '@nestjs/common';
import { ButtonInteraction, ChatInputCommandInteraction, EmbedBuilder, InteractionReplyOptions } from 'discord.js';

import { INTERACTION_REPLY_TIMEOUT_MS } from 'src/discord/constants';

@Injectable()
export class DiscordInteractionHelperService {
  private readonly logger = new Logger(DiscordInteractionHelperService.name);

  public async displaySuccessMessage({
    interaction,
    successMessage,
    shouldDeleteAfterDelay = true,
  }: {
    interaction: ChatInputCommandInteraction;
    successMessage: string;
    shouldDeleteAfterDelay?: boolean;
  }): Promise<void> {
    const addedToQueueEmbedMessage = new EmbedBuilder().setColor(0x57f287).setDescription(successMessage);
    const payload = {
      embeds: [addedToQueueEmbedMessage],
    };

    try {
      const message = interaction.replied ? await interaction.editReply(payload) : await interaction.reply(payload);
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
    try {
      if (interaction.replied) {
        await interaction.editReply(message);
      } else {
        await interaction.reply(message);
      }
      setTimeout(() => interaction.deleteReply(), delayMs);
    } catch (e) {
      this.logger.error('Failed to reply to an interaction', e);
    }
  }
}
