import { Injectable, Logger } from '@nestjs/common';
import { ChatInputCommandInteraction, GuildMember, Interaction } from 'discord.js';

import { YoutubeService } from 'src/youtube/youtube.service';
import { PlayQueueService } from 'src/play.queue/play.queue.service';
import { DiscordAudioService } from 'src/discord/discord.audio.service';
import { DiscordPlayerMessageService } from 'src/discord/discord.player.message.service';
import { DiscordInteractionHelperService } from 'src/discord/discord.interaction.helper.service';
import { ButtonIds, Commands, commands } from 'src/discord/constants';

@Injectable()
export class DiscordInteractionHandlerService {
  private readonly logger = new Logger(DiscordInteractionHandlerService.name);

  constructor(
    private readonly youtubeService: YoutubeService,
    private readonly playQueueService: PlayQueueService,
    private readonly discordAudioService: DiscordAudioService,
    private readonly discordPlayerMessageService: DiscordPlayerMessageService,
    private readonly discordInteractionHelperService: DiscordInteractionHelperService,
  ) {}

  public async playFromUrl(url: string): Promise<void> {
    this.logger.log(`Playing from URL: ${url}`);
  }

  public handleInteraction(interaction: Interaction): void {
    this.logger.log(
      `New interaction detected. Server ID: ${interaction.guildId}. Is command: ${interaction.isCommand()}. Is button: ${interaction.isButton()}.`,
    );
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
      this.discordAudioService.playNextTrack({ interaction, stopCurrent: true, replyToInteraction: true });
    }
    if (buttonId === ButtonIds.DISCONNECT) {
      this.discordAudioService.disconnectFromVoiceChannel(interaction);
    }
  }

  private async handleCommandInteraction(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const isUnknownCommand = !commands.find(({ name }) => name === interaction.commandName);
    if (isUnknownCommand) {
      this.discordInteractionHelperService.replyAndDeleteAfterDelay({ interaction, message: 'Command not found' });
      return;
    }

    if (interaction.commandName === Commands.REFRESH_COMMANDS) {
      interaction.guild.commands.set(commands);
      await this.discordInteractionHelperService.replyAndDeleteAfterDelay({
        interaction,
        message: 'Commands refreshed',
      });
    }

    if (interaction.commandName === Commands.AUTH) {
      const authButton = this.discordInteractionHelperService.getAuthButton();
      await this.discordInteractionHelperService.replyAndDeleteAfterDelay({
        interaction,
        message: {
          components: [authButton],
          content: 'Click the button below to authorize the bot. This link will expire in 1 minute.',
        },
        delayMs: 60_000, // 1 minute
      });
    }

    if ([Commands.PLAY, Commands.P].includes(interaction.commandName as Commands)) {
      this.playFromInteraction(interaction);
    }
  }

  private async playFromInteraction(interaction: ChatInputCommandInteraction): Promise<void> {
    const userInput = interaction.options.getString('link');

    if (!(interaction.member as GuildMember).voice.channel) {
      await this.discordInteractionHelperService.replyAndDeleteAfterDelay({
        interaction,
        message: '⛔ You must be in a voice channel to use this command',
      });
      return;
    }

    await this.play(userInput, interaction);
  }

  private async play(url: string, interaction?: ChatInputCommandInteraction): Promise<void> {
    const { isValid, isPlaylist, isYouTubeLink } = this.youtubeService.validateAndGetLinkInfo(url);

    if (isYouTubeLink && !isValid) {
      await this.discordInteractionHelperService.replyAndDeleteAfterDelay({
        interaction,
        message: '⛔ Invalid link',
      });
      return;
    }

    await this.discordPlayerMessageService.editOrSend(interaction, 'Loading details...');
    const hasItemsInQueue = Boolean(await this.playQueueService.getQueue(interaction.guild.id));

    if (isPlaylist) {
      await this.pushPlaylistToQueue({
        interaction,
        playlistUrl: url,
        hasItemsInQueue,
      });
      if (!hasItemsInQueue) {
        await this.discordAudioService.playAudio({
          interaction,
          onSuccess: () => this.discordPlayerMessageService.sendCurrentTrackDetails(interaction),
        });
      }
      return;
    }

    if (isYouTubeLink) {
      this.pushToQueueAndPlayIfQueueWasEmpty({
        hasItemsInQueue,
        interaction,
        mediaUrl: url,
      });

      return;
    }

    const searchResult = await this.youtubeService.search(url);
    if (!searchResult) {
      await this.discordInteractionHelperService.replyAndDeleteAfterDelay({
        interaction,
        message: '⛔ No results found',
      });
      return;
    }

    this.pushToQueueAndPlayIfQueueWasEmpty({
      hasItemsInQueue,
      interaction,
      mediaUrl: searchResult.url,
    });
  }

  private async pushToQueueAndPlayIfQueueWasEmpty({
    hasItemsInQueue,
    interaction,
    mediaUrl,
  }: {
    hasItemsInQueue: boolean;
    interaction: ChatInputCommandInteraction;
    mediaUrl: string;
  }): Promise<void> {
    if (hasItemsInQueue) {
      await this.pushSingleItemToQueue({ interaction, mediaUrl });
      return;
    }

    await this.playQueueService.pushToQueue({
      guildId: interaction.guild.id,
      urls: mediaUrl,
    });
    await this.discordAudioService.playAudio({
      interaction,
      onSuccess: () => this.discordPlayerMessageService.sendCurrentTrackDetails(interaction),
    });
    return;
  }

  private async pushSingleItemToQueue({
    interaction,
    mediaUrl,
  }: {
    interaction: ChatInputCommandInteraction;
    mediaUrl: string;
  }): Promise<void> {
    await this.playQueueService.pushToQueue({
      guildId: interaction.guild.id,
      urls: mediaUrl,
    });
    const { title } = await this.youtubeService.getVideoInfo(mediaUrl);
    this.discordInteractionHelperService.displaySuccessMessage({
      interaction,
      successMessage: `Added to queue: **${title}**`,
    });

    await this.discordPlayerMessageService.sendCurrentTrackDetails(interaction);
    return;
  }

  private async pushPlaylistToQueue({
    interaction,
    playlistUrl,
    hasItemsInQueue,
  }: {
    interaction: ChatInputCommandInteraction;
    playlistUrl: string;
    hasItemsInQueue: boolean;
  }): Promise<void> {
    if (hasItemsInQueue) {
      try {
        await interaction.reply('Loading playlist details...');
      } catch (e) {
        this.logger.error('Failed to reply to an interaction', e);
      }
    } else {
      await this.discordPlayerMessageService.editOrSend(interaction, 'Loading playlist details...');
    }

    const playlistInfo = await this.youtubeService.getPlaylistInfo(playlistUrl);
    if (!playlistInfo) {
      return;
    }
    const { videosUrls, playlistTitle } = playlistInfo;

    await this.playQueueService.pushToQueue({
      urls: videosUrls,
      guildId: interaction.guild.id,
    });

    await this.discordInteractionHelperService.displaySuccessMessage({
      interaction,
      successMessage: `Added **${videosUrls.length}** items from **${playlistTitle}** to queue`,
      shouldDeleteAfterDelay: hasItemsInQueue,
    });
  }
}
