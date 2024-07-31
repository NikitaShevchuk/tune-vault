import { Injectable, Logger } from '@nestjs/common';
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
import { DbService } from 'src/db/db.service';

@Injectable()
export class DiscordPlayerMessageService {
  private readonly logger = new Logger(DiscordPlayerMessageService.name);

  constructor(
    private readonly youtubeService: YoutubeService,
    private readonly playQueueService: PlayQueueService,
    private readonly discordMessageService: DiscordMessageService,
    private readonly discordGuildService: DiscordGuildService,
    private readonly dbService: DbService,
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
    return (await this.dbService.guild.findUnique({ where: { id: guildId } }))?.activeMessageId;
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
    await this.dbService.guild.update({ where: { id: guildId }, data: { activeMessageId: null } });
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
        : await (await this.discordGuildService.getActiveTextChannel(userId)).messages.fetch(playerMessageId);
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
        : await (await this.discordGuildService.getActiveTextChannel(userId))?.send(message);
      const guildId = interaction ? interaction.guild.id : (await this.discordGuildService.getActiveGuild(userId))?.id;
      const activeMessageId = (await newMessage?.fetch())?.id;
      await this.dbService.guild.update({ where: { id: guildId }, data: { activeMessageId } });
    } catch (e) {
      this.logger.error('Failed to reply to interaction and save message id.', e);
      return null;
    }
  }
}
