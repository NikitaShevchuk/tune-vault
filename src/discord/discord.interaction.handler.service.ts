import { Injectable, Logger } from '@nestjs/common';
import { ChatInputCommandInteraction, GuildMember, Interaction } from 'discord.js';

import { ButtonIds, Commands, commands } from 'src/discord/constants';
import { InteractionOrUserId } from 'src/discord/types';
import { PlayQueueService } from 'src/play.queue/play.queue.service';
import { YoutubeService } from 'src/youtube/youtube.service';
import { DiscordAudioService } from 'src/discord/discord.audio.service';
import { DiscordGuildService } from 'src/discord/discord.guild.service';
import { DiscordMessageService } from 'src/discord/discord.message.service';
import { DiscordPlayerMessageService } from 'src/discord/player/discord.player.message.service';
import { UserService } from 'src/user/user.service';

@Injectable()
export class DiscordInteractionHandlerService {
  private readonly logger = new Logger(DiscordInteractionHandlerService.name);

  constructor(
    private readonly youtubeService: YoutubeService,
    private readonly playQueueService: PlayQueueService,
    private readonly discordAudioService: DiscordAudioService,
    private readonly discordPlayerMessageService: DiscordPlayerMessageService,
    private readonly discordMessageService: DiscordMessageService,
    private readonly discordGuildService: DiscordGuildService,
    private readonly userService: UserService,
  ) {}

  public async playFromHttp({ url, userId }: { url: string; userId: string }): Promise<void> {
    this.play({ url, userId, interaction: undefined });
  }

  public handleInteraction(interaction: Interaction): void {
    this.logger.log(
      `New interaction detected. Server ID: ${interaction.guildId}. Is command: ${interaction.isCommand()}. Is button: ${interaction.isButton()}.`,
    );
    this.updateActiveGuildBasedOnInteraction(interaction);

    if (interaction.isCommand()) {
      this.handleCommandInteraction(interaction);
      return;
    }
    if (interaction.isButton()) {
      this.handleButtonInteraction(interaction);
      return;
    }

    this.logger.error('Unknown interaction type.');
  }

  private handleButtonInteraction(interaction: Interaction): void {
    if (!interaction.isButton()) {
      return;
    }

    const buttonId = interaction.customId;

    if (buttonId === ButtonIds.PREVIOUS) {
      this.discordAudioService.playPrevTrack(interaction);
    }
    if (buttonId === ButtonIds.PLAY_PAUSE) {
      this.discordAudioService.pauseOrPlayAudio(interaction);
    }
    if (buttonId === ButtonIds.NEXT) {
      this.discordAudioService.playNextTrack({
        interaction,
        stopCurrent: true,
        replyToInteraction: true,
        userId: undefined,
      });
    }
    if (buttonId === ButtonIds.DISCONNECT) {
      this.discordAudioService.disconnectFromVoiceChannel({ interaction, userId: undefined });
    }
  }

  private async handleCommandInteraction(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const isUnknownCommand = !commands.find(({ name }) => name === interaction.commandName);
    if (isUnknownCommand) {
      this.discordMessageService.replyAndDeleteAfterDelay({
        interaction,
        message: 'Command not found',
        userId: undefined,
      });
      return;
    }

    if (interaction.commandName === Commands.REFRESH_COMMANDS) {
      interaction.guild.commands.set(commands);
      await this.discordMessageService.replyAndDeleteAfterDelay({
        interaction,
        message: 'Commands refreshed',
        userId: undefined,
      });
    }

    if (interaction.commandName === Commands.AUTH) {
      const authButton = this.discordMessageService.getAuthButton();
      await this.discordMessageService.replyAndDeleteAfterDelay({
        interaction,
        message: {
          components: [authButton],
          content: 'Click the button below to authorize the bot. This link will expire in 1 minute.',
        },
        delayMs: 60_000, // 1 minute
        userId: undefined,
      });
    }

    if ([Commands.PLAY, Commands.P].includes(interaction.commandName as Commands)) {
      this.playFromInteraction(interaction);
    }
  }

  private async playFromInteraction(interaction: ChatInputCommandInteraction): Promise<void> {
    const userInput = interaction.options.getString('link');

    if (!(interaction.member as GuildMember).voice.channel) {
      await this.discordMessageService.replyAndDeleteAfterDelay({
        interaction,
        message: '⛔ You must be in a voice channel to use this command',
        userId: undefined,
      });
      return;
    }

    await this.play({ interaction, url: userInput, userId: undefined });
  }

  /**
   * Plays a track or a playlist from a given URL
   * Either an interaction or a user ID must be provided
   */
  private async play({
    url,
    ...interactionOrUserId
  }: { url: string } & InteractionOrUserId<ChatInputCommandInteraction>): Promise<void> {
    const { isValid, isPlaylist, isYouTubeLink } = this.youtubeService.validateAndGetLinkInfo(url);
    const { interaction, userId } = interactionOrUserId;

    if (isYouTubeLink && !isValid) {
      await this.discordMessageService.replyAndDeleteAfterDelay({
        message: '⛔ Invalid link',
        ...interactionOrUserId,
      });
      return;
    }

    await this.discordPlayerMessageService.editOrReply({
      message: 'Loading details...',
      ...interactionOrUserId,
    });

    const guildId = interaction ? interaction.guild.id : (await this.discordGuildService.getActiveGuild(userId)).id;
    const hasItemsInQueue = Boolean((await this.playQueueService.getOrCreatePlayQueue(guildId)).queue.length);

    if (isPlaylist) {
      await this.pushPlaylistToQueue({
        playlistUrl: url,
        hasItemsInQueue,
        ...interactionOrUserId,
      });
      if (!hasItemsInQueue) {
        await this.discordAudioService.startAudio({
          onSuccess: () => this.discordPlayerMessageService.sendCurrentTrackDetails(interactionOrUserId),
          ...interactionOrUserId,
        });
      }
      return;
    }

    if (isYouTubeLink) {
      this.pushToQueueAndPlayIfQueueWasEmpty({
        hasItemsInQueue,
        mediaUrl: url,
        ...interactionOrUserId,
      });

      return;
    }

    const searchResult = await this.youtubeService.search(url);
    if (!searchResult) {
      await this.discordMessageService.replyAndDeleteAfterDelay({
        message: '⛔ No results found',
        ...interactionOrUserId,
      });
      return;
    }

    this.pushToQueueAndPlayIfQueueWasEmpty({
      hasItemsInQueue,
      mediaUrl: searchResult.url,
      ...interactionOrUserId,
    });
  }

  private async pushToQueueAndPlayIfQueueWasEmpty({
    hasItemsInQueue,
    interaction,
    mediaUrl,
    userId,
  }: {
    hasItemsInQueue: boolean;
    mediaUrl: string;
  } & InteractionOrUserId<ChatInputCommandInteraction>): Promise<void> {
    if (hasItemsInQueue) {
      await this.pushSingleItemToQueue({ interaction, mediaUrl, userId });
      return;
    }
    const guildId = interaction ? interaction.guild.id : (await this.discordGuildService.getActiveGuild(userId)).id;
    await this.playQueueService.pushToQueue({
      guildId,
      urls: mediaUrl,
    });
    await this.discordAudioService.startAudio({
      interaction,
      userId,
      onSuccess: () => this.discordPlayerMessageService.sendCurrentTrackDetails({ interaction, userId }),
    });
    return;
  }

  private async pushSingleItemToQueue({
    interaction,
    userId,
    mediaUrl,
  }: {
    mediaUrl: string;
  } & InteractionOrUserId<ChatInputCommandInteraction>): Promise<void> {
    const guildId = interaction ? interaction.guild.id : (await this.discordGuildService.getActiveGuild(userId)).id;
    await this.playQueueService.pushToQueue({
      guildId,
      urls: mediaUrl,
    });
    const { title } = await this.youtubeService.getVideoInfo(mediaUrl);
    this.discordMessageService.displaySuccessMessage({
      interaction,
      successMessage: `Added to queue: **${title}**`,
      userId,
    });

    await this.discordPlayerMessageService.sendCurrentTrackDetails({ interaction, userId });
    return;
  }

  private async pushPlaylistToQueue({
    playlistUrl,
    hasItemsInQueue,
    interaction,
    userId,
  }: {
    playlistUrl: string;
    hasItemsInQueue: boolean;
  } & InteractionOrUserId<ChatInputCommandInteraction>): Promise<void> {
    if (hasItemsInQueue) {
      try {
        if (!interaction) {
          const activeChannel = await this.discordGuildService.getActiveTextChannel(userId);
          await activeChannel.send('Loading playlist details...');
        } else {
          await interaction.reply('Loading playlist details...');
        }
      } catch (e) {
        this.logger.error('Failed to reply to an interaction', e);
      }
    } else {
      await this.discordPlayerMessageService.editOrReply({
        interaction,
        userId,
        message: 'Loading playlist details...',
      });
    }

    const playlistInfo = await this.youtubeService.getPlaylistInfo(playlistUrl);
    if (!playlistInfo) {
      return;
    }
    const { videosUrls, playlistTitle } = playlistInfo;

    const guildId = interaction ? interaction.guild.id : (await this.discordGuildService.getActiveGuild(userId)).id;
    await this.playQueueService.pushToQueue({ urls: videosUrls, guildId });

    await this.discordMessageService.displaySuccessMessage({
      interaction,
      successMessage: `Added **${videosUrls.length}** items from **${playlistTitle}** to queue`,
      shouldDeleteAfterDelay: hasItemsInQueue,
      userId,
    });
  }

  private async updateActiveGuildBasedOnInteraction(interaction: Interaction): Promise<void> {
    const tuenVaultGuild =
      (await this.discordGuildService.find(interaction.guild.id)) ??
      (await this.discordGuildService.upsert(interaction.guild));
    const activeChannelAlreadySet = tuenVaultGuild.activeChannelId === interaction.channel.id;

    if (!activeChannelAlreadySet) {
      await this.discordGuildService.update({
        id: interaction.guild.id,
        activeChannelId: interaction.channel.id,
      });
    }

    const user =
      (await this.userService.findOne(interaction.user.id)) ??
      (await this.userService.upsertUserFromDiscord(interaction.user));
    const activeGuildAlreadySet = user.activeGuildId === interaction.guild.id;

    if (!activeGuildAlreadySet) {
      await this.userService.update(user.id, {
        activeGuildId: interaction.guild.id,
      });
    }
  }
}
