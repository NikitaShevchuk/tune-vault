import { Injectable } from '@nestjs/common';
import { ButtonInteraction, ChatInputCommandInteraction, GuildMember, Interaction } from 'discord.js';
import { getVoiceConnection } from '@discordjs/voice';

import { YoutubeService } from 'src/youtube/youtube.service';
import { PlayQueueService } from 'src/play.queue/play.queue.service';
import { DiscordAudioService } from 'src/discord/discord.audio.service';
import { DiscordPlayerMessageService } from 'src/discord/discord.player.message.service';
import { DiscordInteractionHelperService } from 'src/discord/discord.interaction.helper.service';
import { ButtonIds, Commands, commands } from 'src/discord/constants';

@Injectable()
export class DiscordInteractionHandlerService {
  constructor(
    private readonly youtubeService: YoutubeService,
    private readonly playQueueService: PlayQueueService,
    private readonly discordAudioService: DiscordAudioService,
    private readonly discordPlayerMessageService: DiscordPlayerMessageService,
    private readonly discordInteractionHelperService: DiscordInteractionHelperService,
  ) {}

  public handleButtonInteraction(interaction: Interaction): void {
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
      this.disconnectFromVoiceChannel(interaction);
    }
  }

  public async handleCommandInteraction(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const isUnknownCommand = !commands.find(({ name }) => name === interaction.commandName);
    if (isUnknownCommand) {
      interaction.reply('Command not found');
      return;
    }

    if (interaction.commandName === Commands.REFRESH_COMMANDS) {
      interaction.guild.commands.set(commands);
    }

    if ([Commands.PLAY, Commands.P].includes(interaction.commandName as Commands)) {
      this.handlePlayCommand(interaction);
    }
  }

  public async handlePlayCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const userInput = interaction.options.getString('link');

    if (!(interaction.member as GuildMember).voice.channel) {
      await interaction.reply('⛔ You must be in a voice channel to use this command');
      return;
    }

    const { isValid, isVideo, isPlaylist } = this.youtubeService.validateAndGetLinkInfo(userInput);

    if (!isValid) {
      await interaction.reply('⛔ Invalid link');
      return;
    }

    await this.discordPlayerMessageService.editOrCreate(interaction, 'Loading details...');

    const hasItemsInQueue = Boolean(await this.playQueueService.getQueue(interaction.guild.id));

    if (hasItemsInQueue && !isPlaylist) {
      await this.pushSingleItemToQueue({ interaction, mediaUrl: userInput });
    }

    if (!hasItemsInQueue && isVideo) {
      await this.playQueueService.pushToQueue({
        guildId: interaction.guild.id,
        urls: userInput,
      });

      await this.discordAudioService.playAudio(interaction, () =>
        this.discordPlayerMessageService.sendOrEditPlayerMessage(interaction),
      );
    }

    if (isPlaylist) {
      await this.pushPlaylistToQueue({
        interaction,
        playlistUrl: userInput,
        hasItemsInQueue,
      });
      if (!hasItemsInQueue) {
        await this.discordAudioService.playAudio(interaction, () =>
          this.discordPlayerMessageService.sendOrEditPlayerMessage(interaction),
        );
      }
    }
  }

  public disconnectFromVoiceChannel(interaction: ButtonInteraction): void {
    const connection = getVoiceConnection(interaction.guild.id);
    connection?.destroy();
    interaction.reply('Disconnected');
    this.playQueueService.destroyQueue(interaction.guild.id);
    this.discordPlayerMessageService.delete(interaction.guild.id);
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
      editPrevReply: false,
    });

    await this.discordPlayerMessageService.sendOrEditPlayerMessage(interaction);
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
      await interaction.reply('Loading playlist details...');
    } else {
      await this.discordPlayerMessageService.editOrCreate(interaction, 'Loading playlist details...');
    }

    const { videosUrls, playlistTitle } = await this.youtubeService.getPlaylistInfo(playlistUrl);
    await this.playQueueService.pushToQueue({
      urls: videosUrls,
      guildId: interaction.guild.id,
    });

    await this.discordInteractionHelperService.displaySuccessMessage({
      interaction,
      successMessage: `Added **${videosUrls.length}** items from **${playlistTitle}** to queue`,
      editPrevReply: true,
      shouldDeleteAfterDelay: hasItemsInQueue,
    });
  }
}
