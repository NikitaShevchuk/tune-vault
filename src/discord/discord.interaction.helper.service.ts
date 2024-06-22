import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  InteractionReplyOptions,
  MessageActionRowComponentBuilder,
} from 'discord.js';

import { INTERACTION_REPLY_TIMEOUT_MS } from 'src/discord/constants';
import { DiscordClientService } from 'src/discord/discord.client.service';

@Injectable()
export class DiscordInteractionHelperService {
  private readonly logger = new Logger(DiscordInteractionHelperService.name);

  constructor(
    private readonly discordClientService: DiscordClientService,
    private readonly configService: ConfigService,
  ) {}

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
    interaction?: ChatInputCommandInteraction | ButtonInteraction;
    message: string | InteractionReplyOptions;
    delayMs?: number;
  }): Promise<void> {
    try {
      if (!interaction) {
        this.discordClientService.client.guilds.fetch;
        return;
      }

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

  public getAuthButton(): ActionRowBuilder<MessageActionRowComponentBuilder> {
    const oauth2url = this.configService.get<string>('DISCORD_AUTH_URL');
    const authButton = new ButtonBuilder().setLabel('🔒 Authorize').setStyle(ButtonStyle.Link).setURL(oauth2url);
    return new ActionRowBuilder().addComponents(authButton) as ActionRowBuilder<MessageActionRowComponentBuilder>;
  }
}
