import { Injectable, Logger } from '@nestjs/common';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  InteractionReplyOptions,
  MessageActionRowComponentBuilder,
  TextChannel,
} from 'discord.js';
import { ConfigService } from '@nestjs/config';

import { INTERACTION_REPLY_TIMEOUT_MS } from 'src/discord/constants';
import { InteractionOrUserId, ReplyPayload } from 'src/discord/types';
import { DiscordClientService } from 'src/discord/discord.client.service';
import { DiscordGuildService } from 'src/discord/discord.guild.service';
import { Configuration } from 'src/config/configuration';

@Injectable()
export class DiscordMessageService {
  private readonly logger = new Logger(DiscordMessageService.name);

  constructor(
    private readonly discordClientService: DiscordClientService,
    private readonly discordGuildService: DiscordGuildService,
    private readonly configService: ConfigService<Configuration, true>,
  ) {}

  public async displaySuccessMessage({
    interaction,
    successMessage,
    shouldDeleteAfterDelay = true,
    userId,
  }: {
    successMessage: string;
    shouldDeleteAfterDelay?: boolean;
  } & InteractionOrUserId<ChatInputCommandInteraction>): Promise<void> {
    const addedToQueueEmbedMessage = new EmbedBuilder().setColor(0x57f287).setDescription(successMessage);
    const payload = { embeds: [addedToQueueEmbedMessage] };
    try {
      if (!interaction) {
        const activeChannel = await this.getActiveTextChannel(userId);
        await activeChannel.send(payload);

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
   * Reply to an interaction or create a new message and delete the reply after a delay.
   * Either `interaction`  or `userId` must be provided.
   * We need this because we have 2 options to play a track: either from a command or from an endpoint (request from the Chrome extension).
   */
  public async replyAndDeleteAfterDelay({
    interaction,
    message,
    userId,
    delayMs = INTERACTION_REPLY_TIMEOUT_MS,
  }: {
    delayMs?: number;
  } & ReplyPayload<ChatInputCommandInteraction | ButtonInteraction>): Promise<void> {
    try {
      if (!interaction) {
        const activeChannel = await this.getActiveTextChannel(userId);
        const newMessage = await activeChannel.send(message);
        setTimeout(() => newMessage.delete(), delayMs);
        return;
      }

      if (interaction.replied) {
        await interaction.editReply(message);
      } else {
        await interaction.reply(message as InteractionReplyOptions);
      }
      setTimeout(() => interaction.deleteReply(), delayMs);
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

  public async getActiveTextChannel(userId: string): Promise<TextChannel | null> {
    const userActiveGuild = await this.discordGuildService.getActiveGuild(userId);
    const guild = await this.discordClientService.client.guilds.fetch(userActiveGuild.id);

    // Try to get the active channel saved in the database
    if (userActiveGuild.activeChannelId) {
      const channel = await guild.channels.fetch(userActiveGuild.activeChannelId);
      if (!channel.isTextBased()) {
        return null;
      }
      return channel as TextChannel;
    }

    // Fallback to the first text channel in the guild
    const channels = await guild.channels.fetch();
    const textChannel = channels.find((channel) => channel.isTextBased()) as TextChannel;
    return textChannel ?? null;
  }
}
