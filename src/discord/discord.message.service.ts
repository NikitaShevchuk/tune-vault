import { Injectable, Logger } from '@nestjs/common';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CommandInteraction,
  EmbedBuilder,
  InteractionReplyOptions,
  Message,
  MessageActionRowComponentBuilder,
} from 'discord.js';
import { ConfigService } from '@nestjs/config';

import { INTERACTION_REPLY_TIMEOUT_MS } from 'src/discord/constants';
import { InteractionOrGuildId, ReplyPayload } from 'src/discord/types';
import { DiscordGuildService } from 'src/discord/discord.guild.service';
import { Configuration } from 'src/config/configuration';

@Injectable()
export class DiscordMessageService {
  private readonly logger = new Logger(DiscordMessageService.name);

  constructor(
    private readonly discordGuildService: DiscordGuildService,
    private readonly configService: ConfigService<Configuration, true>,
  ) {}

  public async displayMessage({
    interaction,
    message,
    shouldDeleteAfterDelay = true,
    guildId,
  }: {
    message: string;
    shouldDeleteAfterDelay?: boolean;
  } & InteractionOrGuildId): Promise<void> {
    const addedToQueueEmbedMessage = new EmbedBuilder().setColor(0x57f287).setDescription(message);
    const payload = { embeds: [addedToQueueEmbedMessage] };
    try {
      if (!interaction) {
        const activeChannel = await this.discordGuildService.getActiveTextChannelByGuildId(guildId);
        const message = await activeChannel.send(payload);

        if (shouldDeleteAfterDelay) {
          setTimeout(() => {
            message.delete();
          }, INTERACTION_REPLY_TIMEOUT_MS);
        }
        return;
      }

      const message = interaction.replied ? await interaction.editReply(payload) : await interaction.reply(payload);

      if (shouldDeleteAfterDelay) {
        setTimeout(() => {
          message.delete();
        }, INTERACTION_REPLY_TIMEOUT_MS);
      }
    } catch (error) {
      // TODO: Add sentry logging
      this.logger.error('Failed to send message', error);
    }
  }

  /**
   * Either `interaction`  or `guildId` must be provided.
   * We need this because we have 2 options to play a track: either from a command or from an endpoint (request from the Chrome extension).
   */
  public async replyAndDeleteAfterDelay({
    message,
    delayMs = INTERACTION_REPLY_TIMEOUT_MS,
    guildId,
    interaction,
  }: {
    delayMs?: number;
  } & ReplyPayload): Promise<void> {
    const { newMessage } = await this.reply({ message, guildId, interaction });
    const deleteMessage = async () => {
      if (newMessage) {
        return await newMessage.delete();
      } else if (interaction) {
        return await interaction.deleteReply();
      }
    };

    setTimeout(async () => {
      try {
        await deleteMessage();
      } catch (e) {
        // TODO: Add sentry logging
        this.logger.error('Failed to delete message', e);
      }
    }, delayMs);
  }

  /**
   * Either `interaction`  or `userId` must be provided.
   * We need this because we have 2 options to play a track: either from a command or from an endpoint (request from the Chrome extension).
   */
  public async reply({ interaction, message, guildId }: ReplyPayload): Promise<{
    newMessage: Message | null;
  }> {
    try {
      if (!interaction) {
        return await this.createNewMessage({ guildId, message });
      }
      return await this.replyToInteraction({ interaction, message });
    } catch (e) {
      // TODO: Add sentry logging
      this.logger.error('Failed to reply to an interaction', e);
    }
  }

  public getAuthButton(): ActionRowBuilder<MessageActionRowComponentBuilder> {
    const authButton = new ButtonBuilder()
      .setLabel('🔒 Authorize')
      .setStyle(ButtonStyle.Link)
      .setURL(this.configService.get('authUrl', { infer: true }));

    return new ActionRowBuilder().addComponents(authButton) as ActionRowBuilder<MessageActionRowComponentBuilder>;
  }

  private async replyToInteraction({
    message,
    interaction,
  }: {
    interaction: ButtonInteraction | CommandInteraction;
    message: ReplyPayload['message'];
  }): Promise<{ newMessage: null }> {
    if (interaction.replied) {
      await interaction.editReply(message);
    } else {
      await interaction.reply(message as InteractionReplyOptions);
    }
    return { newMessage: null };
  }

  private async createNewMessage({
    message,
    guildId,
  }: {
    message: ReplyPayload['message'];
    guildId: string;
  }): Promise<{ newMessage: Message }> {
    const activeChannel = await this.discordGuildService.getActiveTextChannelByGuildId(guildId);
    if (!activeChannel) {
      return;
    }

    const newMessage = await activeChannel.send(message);
    return { newMessage };
  }
}
