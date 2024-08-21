import { Injectable, Logger } from '@nestjs/common';
import {
  ActionRowBuilder,
  BaseMessageOptions,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CommandInteraction,
  EmbedBuilder,
  InteractionReplyOptions,
  InteractionResponse,
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
    guildId,
    displayAsEmbed = true,
    shouldDeleteAfterDelay = true,
  }: {
    message: string;
    displayAsEmbed?: boolean;
    shouldDeleteAfterDelay?: boolean;
  } & InteractionOrGuildId): Promise<void> {
    const embedMessageContent = new EmbedBuilder().setColor(0x57f287).setDescription(message);
    const payload = displayAsEmbed ? { embeds: [embedMessageContent] } : { content: message };

    try {
      const message = interaction
        ? await this.replyToInteractionOrSendNewMessage(interaction, payload)
        : await this.sendMessageInGuildById(guildId, payload);

      if (shouldDeleteAfterDelay) {
        this.deleteMessageWithTimeout(message);
      }
    } catch (error) {
      // TODO: Add sentry logging
      this.logger.error('Failed to send message', error);
    }
  }

  private async replyToInteractionOrSendNewMessage(
    interaction: ButtonInteraction | CommandInteraction,
    payload: BaseMessageOptions,
  ): Promise<Message | InteractionResponse> {
    if (interaction.replied) {
      return await interaction.channel.send(payload);
    }
    return await interaction.reply(payload);
  }

  private async sendMessageInGuildById(guildId: string, payload: BaseMessageOptions): Promise<Message> {
    const activeChannel = await this.discordGuildService.getActiveTextChannelByGuildId(guildId);
    return await activeChannel.send(payload);
  }

  private deleteMessageWithTimeout(message: Message | InteractionResponse): void {
    setTimeout(() => {
      try {
        message.delete();
      } catch (e) {
        // TODO add sentry logging
        this.logger.error(e.message, e);
      }
    }, INTERACTION_REPLY_TIMEOUT_MS);
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
    newMessage: Message | InteractionResponse | null;
  }> {
    try {
      if (!interaction) {
        return await this.createNewMessage({ guildId, message });
      }
      return await this.editOrReplyToInteraction({ interaction, message });
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

  private async editOrReplyToInteraction({
    message,
    interaction,
  }: {
    interaction: ButtonInteraction | CommandInteraction;
    message: ReplyPayload['message'];
  }): Promise<{ newMessage: InteractionResponse | Message }> {
    const newMessage = interaction.replied
      ? await interaction.editReply(message)
      : await interaction.reply(message as InteractionReplyOptions);

    return { newMessage };
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
      return { newMessage: null };
    }

    const newMessage = await activeChannel.send(message);
    return { newMessage };
  }
}
