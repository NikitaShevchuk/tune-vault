import { Injectable, Logger } from '@nestjs/common';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Message,
  MessageActionRowComponentBuilder,
  MessageCreateOptions,
  MessageEditOptions,
  MessagePayload,
} from 'discord.js';

import { DiscordPlayerState, InteractionOrGuildId, ReplyPayload } from 'src/discord/types';
import { DiscordGuildService } from 'src/discord/discord.guild.service';
import { PlayerEvents } from './actions';
import { TrackDetails } from 'src/youtube/types';
import { DiscordMessageService } from '../discord.message.service';

@Injectable()
export class DiscordPlayerMessageService {
  private readonly logger = new Logger(DiscordPlayerMessageService.name);

  constructor(
    private readonly discordGuildService: DiscordGuildService,
    private readonly discordMessageService: DiscordMessageService,
  ) {}

  public async sendCurrentTrackDetails({
    interaction,
    guildId,
    playerState,
  }: InteractionOrGuildId & { playerState: DiscordPlayerState }): Promise<void> {
    const message = await this.getPlayerMessagePayload(playerState);
    await this.editOrReply({ interaction, message, guildId });
  }

  public async get(guildId: string): Promise<string | null> {
    return (await this.discordGuildService.find(guildId))?.activeMessageId;
  }

  /**
   * Will edit the existing player message if it exists, otherwise will reply to the interaction and save the message id.
   * We don't want to spam the channel with multiple player messages.
   */
  public async editOrReply(messageOptions: ReplyPayload): Promise<Message | null> {
    const playerMessageId = await this.get(messageOptions.guildId);

    if (!playerMessageId) {
      await this.replyToInteractionAndSaveMessageId(messageOptions);
      return;
    }

    return await this.editExistingMessage({ playerMessageId, ...messageOptions });
  }

  public async delete(guildId: string): Promise<void> {
    await this.discordGuildService.update({ id: guildId, activeMessageId: null });
  }

  private async getPlayerMessagePayload(
    playerState: DiscordPlayerState,
  ): Promise<MessagePayload | MessageCreateOptions> {
    if (!playerState.currentTrack) {
      return {
        content: 'No items in the queue',
      };
    }

    const embedVideoInfo = await this.getEmbedVideoInfoForDiscord(playerState);
    const actionsRow = this.getActionRow();

    return {
      embeds: [embedVideoInfo],
      content: '',
      components: [actionsRow],
    };
  }

  private getActionRow(): ActionRowBuilder<MessageActionRowComponentBuilder> {
    const prevButton = new ButtonBuilder()
      .setCustomId(PlayerEvents.PLAY_PREV)
      .setEmoji('⏮')
      .setStyle(ButtonStyle.Secondary);

    const playButton = new ButtonBuilder()
      .setCustomId(PlayerEvents.PAUSE_OR_PLAY)
      .setEmoji('⏯')
      .setStyle(ButtonStyle.Secondary);

    const nextButton = new ButtonBuilder()
      .setCustomId(PlayerEvents.PLAY_NEXT)
      .setEmoji('⏭')

      .setStyle(ButtonStyle.Secondary);

    const disconnectButton = new ButtonBuilder()
      .setCustomId(PlayerEvents.DISCONNECT_BOT)
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
    guildId,
    playerMessageId,
    message,
  }: { playerMessageId: string } & ReplyPayload): Promise<Message | null> {
    try {
      const existingMessage = interaction
        ? await interaction.channel.messages.fetch(playerMessageId)
        : await (await this.discordGuildService.getActiveTextChannelByGuildId(guildId)).messages.fetch(playerMessageId);
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

  private async replyToInteractionAndSaveMessageId({ interaction, message, guildId }: ReplyPayload): Promise<void> {
    try {
      const { newMessage } = await this.discordMessageService.reply({ interaction, guildId, message });
      const activeMessageId = (await newMessage?.fetch())?.id;
      await this.discordGuildService.update({ id: guildId, activeMessageId });
    } catch (e) {
      // TODO add sentry logging
      this.logger.error('Failed to reply to interaction and save message id.', e);
    }
  }

  private async getEmbedVideoInfoForDiscord({
    currentTrack,
    nextTrack,
  }: {
    currentTrack: TrackDetails;
    nextTrack: TrackDetails;
  }): Promise<EmbedBuilder> {
    try {
      const payload = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`${currentTrack.title}  ▶︎ ${currentTrack.formattedDuration} •၊၊||။‌‌‌‌‌၊|•`)
        .setURL(currentTrack.url)
        .setAuthor({
          name: currentTrack.authorName,
          iconURL: currentTrack.authorThumbnail,
          url: currentTrack.authorUrl,
        })
        .setThumbnail(currentTrack.thumbnail);

      if (nextTrack) {
        payload.setDescription(`Next  •  **${nextTrack.title}**`);
      }

      return payload;
    } catch (e) {
      // TODO add sentry logging
      this.logger.error('Failed to get video info', e);
      return new EmbedBuilder().setColor(0xff0000).setTitle('Failed to get video info');
    }
  }
}
