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
  MessageEditOptions,
  MessagePayload,
} from 'discord.js';

import { ButtonIds } from 'src/discord/constants';
import { PlayQueueService } from 'src/play.queue/play.queue.service';
import { YoutubeService } from 'src/youtube/youtube.service';

const PLAYER_MESSAGES_IDS_KEY = 'player-messages-ids';

@Injectable()
export class DiscordPlayerMessageService {
  private readonly logger = new Logger(DiscordPlayerMessageService.name);

  constructor(
    private readonly youtubeService: YoutubeService,
    private readonly playQueueService: PlayQueueService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  public async sendCurrentTrackDetails(interaction: CommandInteraction | ButtonInteraction): Promise<void> {
    const interactionReplyPayload = await this.getPlayerMessagePayload(interaction.guild.id);
    await this.editOrSend(interaction, interactionReplyPayload);
  }

  public async editOrSend(
    interaction: CommandInteraction | ButtonInteraction,
    message: string | InteractionReplyOptions | MessagePayload,
  ): Promise<Message | null> {
    const playerMessageId = await this.get(interaction.guild.id);
    if (!playerMessageId) {
      return await this.replyToInteractionAndSaveMessageId(interaction, message);
    }
    return await this.editExistingMessage(interaction, message, playerMessageId);
  }

  public async delete(guildId: string): Promise<void> {
    const allPlayersMessagesIds = await this.cacheManager.get<Record<string, string>>(PLAYER_MESSAGES_IDS_KEY);

    if (!allPlayersMessagesIds?.[guildId]) {
      return;
    }

    delete allPlayersMessagesIds[guildId];

    await this.cacheManager.set(PLAYER_MESSAGES_IDS_KEY, allPlayersMessagesIds);
  }

  public async getPlayerMessagePayload(guildId: string): Promise<InteractionReplyOptions> {
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

  private async editExistingMessage(
    interaction: CommandInteraction | ButtonInteraction,
    message: string | InteractionReplyOptions | MessagePayload,
    playerMessageId: string,
  ): Promise<Message | null> {
    try {
      const existingMessage = await interaction.channel.messages.fetch(playerMessageId);
      if (existingMessage) {
        await existingMessage.edit(message as MessageEditOptions);
        return existingMessage;
      }
      return null;
    } catch (e) {
      this.logger.error('Failed to fetch existing player message.', e);
      return null;
    }
  }

  private async replyToInteractionAndSaveMessageId(
    interaction: CommandInteraction | ButtonInteraction,
    message: string | InteractionReplyOptions | MessagePayload,
  ): Promise<Message | null> {
    try {
      const newInteractionReply = await interaction.reply(message);
      if (newInteractionReply) {
        const newMessage = await newInteractionReply.fetch();
        const allPlayersMessagesIds = await this.cacheManager.get<Record<string, string> | null>(
          PLAYER_MESSAGES_IDS_KEY,
        );

        await this.cacheManager.set(PLAYER_MESSAGES_IDS_KEY, {
          ...(allPlayersMessagesIds ?? {}),
          [interaction.guildId]: newMessage.id,
        });

        return newMessage;
      }
    } catch (e) {
      this.logger.error('Failed to reply to interaction and save message id.', e);
      return null;
    }
    return null;
  }

  public async get(guildId: string): Promise<string | null> {
    const playerMessagesIds = await this.cacheManager.get<Record<string, string>>(PLAYER_MESSAGES_IDS_KEY);

    if (playerMessagesIds && playerMessagesIds[guildId]) {
      return playerMessagesIds[guildId];
    }

    return null;
  }
}
