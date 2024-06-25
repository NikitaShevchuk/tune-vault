import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CommandInteraction,
  InteractionReplyOptions,
  Message,
  MessageActionRowComponentBuilder,
  MessageCreateOptions,
  MessageEditOptions,
  MessagePayload,
} from 'discord.js';

import { ButtonIds } from 'src/discord/constants';
import { InteractionOrUserId, ReplyPayload } from 'src/discord/types';
import { PlayQueueService } from 'src/play.queue/play.queue.service';
import { YoutubeService } from 'src/youtube/youtube.service';
import { DiscordGuildService } from 'src/discord/discord.guild.service';
import { DiscordMessageService } from 'src/discord/discord.message.service';

const PLAYER_MESSAGES_IDS_KEY = 'player-messages-ids';

@Injectable()
export class DiscordPlayerMessageService {
  private readonly logger = new Logger(DiscordPlayerMessageService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,

    private readonly youtubeService: YoutubeService,
    private readonly playQueueService: PlayQueueService,
    private readonly discordMessageService: DiscordMessageService,
    private readonly discordGuildService: DiscordGuildService,
  ) {}

  public async sendCurrentTrackDetails({
    interaction,
    userId,
  }: InteractionOrUserId<CommandInteraction | ButtonInteraction>): Promise<void> {
    const guildId = interaction ? interaction.guild.id : (await this.discordGuildService.getActiveGuild(userId))?.id;
    const message = await this.getPlayerMessagePayload(guildId);
    await this.editOrReply({ interaction, message, userId });
  }

  public async get(guildId: string): Promise<string | null> {
    const playerMessagesIds = await this.cacheManager.get<Record<string, string>>(PLAYER_MESSAGES_IDS_KEY);

    if (playerMessagesIds && playerMessagesIds[guildId]) {
      return playerMessagesIds[guildId];
    }

    return null;
  }

  /**
   * Will edit the existing player message if it exists, otherwise will reply to the interaction and save the message id.
   * We don't want to spam the channel with multiple player messages.
   */
  public async editOrReply(
    messageOptions: ReplyPayload<CommandInteraction | ButtonInteraction>,
  ): Promise<Message | null> {
    const { interaction, userId } = messageOptions;

    const guildId = interaction ? interaction.guild.id : (await this.discordGuildService.getActiveGuild(userId))?.id;
    const playerMessageId = await this.get(guildId);

    if (!playerMessageId) {
      await this.replyToInteractionAndSaveMessageId(messageOptions);
      return;
    }

    return await this.editExistingMessage({ playerMessageId, ...messageOptions });
  }

  public async delete(guildId: string): Promise<void> {
    const allPlayersMessagesIds = await this.cacheManager.get<Record<string, string>>(PLAYER_MESSAGES_IDS_KEY);

    if (!allPlayersMessagesIds?.[guildId]) {
      return;
    }

    delete allPlayersMessagesIds[guildId];

    await this.cacheManager.set(PLAYER_MESSAGES_IDS_KEY, allPlayersMessagesIds);
  }

  public async getPlayerMessagePayload(guildId: string): Promise<MessagePayload | MessageCreateOptions> {
    const currentVideo = await this.playQueueService.getCurrentItem(guildId);
    const nextVideo = await this.playQueueService.getNextItem({
      guildId,
      markCurrentAsPlayed: false,
    });

    if (!currentVideo) {
      return {
        content: 'No items in the queue',
      };
    }

    const embedVideoInfo = await this.youtubeService.getEmbedVideoInfoForDiscord(currentVideo.url, nextVideo?.url);
    const actionsRow = this.getActionRow();

    return {
      embeds: [embedVideoInfo],
      content: '',
      components: [actionsRow],
    };
  }

  private getActionRow(): ActionRowBuilder<MessageActionRowComponentBuilder> {
    const prevButton = new ButtonBuilder()
      .setCustomId(ButtonIds.PREVIOUS)
      .setEmoji('⏮')
      .setStyle(ButtonStyle.Secondary);

    const playButton = new ButtonBuilder()
      .setCustomId(ButtonIds.PLAY_PAUSE)
      .setEmoji('⏯')
      .setStyle(ButtonStyle.Secondary);

    const nextButton = new ButtonBuilder()
      .setCustomId(ButtonIds.NEXT)
      .setEmoji('⏭')

      .setStyle(ButtonStyle.Secondary);

    const disconnectButton = new ButtonBuilder()
      .setCustomId(ButtonIds.DISCONNECT)
      .setEmoji('⛔')
      .setStyle(ButtonStyle.Secondary);

    return new ActionRowBuilder().addComponents(
      prevButton,
      playButton,
      nextButton,
      disconnectButton,
    ) as ActionRowBuilder<MessageActionRowComponentBuilder>;
  }

  private async editExistingMessage({
    interaction,
    userId,
    playerMessageId,
    message,
  }: { playerMessageId: string } & ReplyPayload<CommandInteraction | ButtonInteraction>): Promise<Message | null> {
    try {
      const existingMessage = interaction
        ? await interaction.channel.messages.fetch(playerMessageId)
        : await (await this.discordMessageService.getActiveTextChannel(userId)).messages.fetch(playerMessageId);
      if (existingMessage) {
        await existingMessage.edit(message as unknown as MessageEditOptions);
        return existingMessage;
      }
      return null;
    } catch (e) {
      this.logger.error('Failed to fetch existing player message.', e);
      return null;
    }
  }

  private async replyToInteractionAndSaveMessageId({
    interaction,
    message,
    userId,
  }: ReplyPayload<CommandInteraction | ButtonInteraction>): Promise<void> {
    try {
      const newMessage = interaction
        ? await interaction.reply(message as InteractionReplyOptions)
        : await (await this.discordMessageService.getActiveTextChannel(userId))?.send(message);
      const guildId = interaction ? interaction.guild.id : (await this.discordGuildService.getActiveGuild(userId))?.id;

      const allPlayersMessagesIds = await this.cacheManager.get<Record<string, string> | null>(PLAYER_MESSAGES_IDS_KEY);
      await this.cacheManager.set(PLAYER_MESSAGES_IDS_KEY, {
        ...(allPlayersMessagesIds ?? {}),
        [guildId]: (await newMessage?.fetch())?.id,
      });
    } catch (e) {
      this.logger.error('Failed to reply to interaction and save message id.', e);
      return null;
    }
  }
}
