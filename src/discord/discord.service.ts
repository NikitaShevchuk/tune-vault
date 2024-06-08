import { Injectable, Logger } from '@nestjs/common';
import {
  AudioPlayerStatus,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  getVoiceConnection,
  joinVoiceChannel,
} from '@discordjs/voice';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
  Interaction,
  MessageActionRowComponentBuilder,
} from 'discord.js';
import { stream as streamFromYtLink } from 'play-dl';

import { ButtonIds, Commands, commands, intents } from 'src/discord/constants';
import { DiscordHelperService } from 'src/discord/discord.helper.service';
import { YoutubeService } from 'src/youtube/youtube.service';
import { PlayQueueService } from '../play.queue/play.queue.service';

@Injectable()
export class DiscordService {
  private readonly logger = new Logger(DiscordService.name);
  private readonly client = new Client({
    intents,
  });

  constructor(
    private readonly discordHelperService: DiscordHelperService,
    private readonly youtubeService: YoutubeService,
    private readonly playQueueService: PlayQueueService,
  ) {}

  public initialize() {
    // Handle errors
    this.client.on('error', (error) => {
      this.logger.error('An error occurred.', error);
    });

    // Login
    this.client.login(process.env.DISCORD_BOT_TOKEN);
    this.client.on('ready', () => {
      this.logger.log(`🚀 Logged in as 🟢${this.client.user.tag}`);
    });

    // Set commands when joining a server
    this.client.on('guildCreate', (guild) => {
      this.logger.log(`👋 Joined server: ${guild.name}`);
      guild.commands.set(commands);
    });

    // Handle interactions. NOTE: Potential place for exceptions
    this.client.on('interactionCreate', (i) => this.handleInteraction(i));
  }

  private handleInteraction(interaction: Interaction): void {
    try {
      this.logger.log(
        `New interaction detected. Server ID: ${interaction.guildId}. Is command: ${interaction.isCommand()}. Is button: ${interaction.isButton()}. Is select menu: ${interaction.isSelectMenu()}.`,
      );
      if (interaction.isCommand()) {
        this.handleCommandInteraction(interaction);
        return;
      }
      if (interaction.isButton()) {
        this.logger.log('Button interaction detected.');
        this.handleButtonInteraction(interaction);
        return;
      }

      this.logger.error('Unknown interaction type.');
    } catch (e) {
      this.logger.error('Failed to handle an interaction.', e);
    }
  }

  private handleButtonInteraction(interaction: Interaction): void {
    if (!interaction.isButton()) {
      return;
    }

    const buttonId = interaction.customId;

    if (buttonId === ButtonIds.PREVIOUS) {
      this.logger.log('Previous button clicked.');
    }
    if (buttonId === ButtonIds.PLAY_PAUSE) {
      this.logger.log('Play/Pause button clicked.');
    }
    if (buttonId === ButtonIds.NEXT) {
      this.logger.log('Next button clicked.');
    }
    if (buttonId === ButtonIds.DISCONNECT) {
      const connection = getVoiceConnection(interaction.guild.id);
      connection?.destroy();
      interaction.reply('Disconnected');
      this.playQueueService.destroyQueue(interaction.guild.id);
    }
  }

  private async handleCommandInteraction(
    interaction: Interaction,
  ): Promise<void> {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const isUnknownCommand = !commands.find(
      ({ name }) => name === interaction.commandName,
    );
    if (isUnknownCommand) {
      interaction.reply('Command not found');
      return;
    }

    if (interaction.commandName === Commands.REFRESH_COMMANDS) {
      interaction.guild.commands.set(commands);
    }

    if (
      [Commands.PLAY, Commands.P].includes(interaction.commandName as Commands)
    ) {
      this.handlePlayCommand(interaction);
    }
  }

  private async handlePlayCommand(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const userInput = interaction.options.getString('link');

    if (!(interaction.member as GuildMember).voice.channel) {
      await interaction.reply(
        '⛔ You must be in a voice channel to use this command',
      );
      return;
    }

    const { isValid, isVideo, isPlaylist } =
      this.youtubeService.validateAndGetLinkInfo(userInput);

    if (!isValid) {
      await interaction.reply('⛔ Invalid link');
      return;
    }

    const hasItemsInQueue = Boolean(
      await this.playQueueService.getQueue(interaction.guild.id),
    );

    if (hasItemsInQueue) {
      await this.playQueueService.pushToQueue(interaction.guild.id, userInput);
      const { title } = await this.youtubeService.getVideoInfo(userInput);

      await interaction.reply(`**${title}** added to queue`);
      return;
    }

    if (isVideo) {
      await this.playQueueService.pushToQueue(interaction.guild.id, userInput);
      this.playAudio(interaction);

      await interaction.reply('Loading details...');

      const embedVideoInfo =
        await this.youtubeService.getEmbedVideoInfoForDiscord(userInput);
      const actionsRow = this.getActionRow();

      await interaction.editReply({
        embeds: [embedVideoInfo],
        content: '',
        components: [actionsRow],
      });
    }

    if (isPlaylist) {
      const videosUrls = await this.youtubeService.getPlaylistInfo(userInput);
      this.playQueueService.pushToQueue(interaction.guild.id, videosUrls);
    }
  }

  private async playAudio(interaction: Interaction): Promise<void> {
    const itemToPlay = await this.playQueueService.getNextItem(
      interaction.guild.id,
    );
    if (!itemToPlay) {
      this.logger.error('Warning! No items to play. We should not be here.');
      return;
    }

    const existingConnection = getVoiceConnection(interaction.guild.id);
    const connection =
      existingConnection ??
      joinVoiceChannel({
        channelId: (interaction.member as GuildMember).voice.channel.id,
        guildId: interaction.guild.id,
        adapterCreator: interaction.guild.voiceAdapterCreator,
        selfDeaf: true,
      });
    const player = createAudioPlayer();

    connection.on(VoiceConnectionStatus.Ready, async () => {
      try {
        const { stream } = await streamFromYtLink(itemToPlay.url, {
          discordPlayerCompatibility: true,
        });
        const resource = createAudioResource(stream);
        connection.subscribe(player);
        player.play(resource);
      } catch (e) {
        this.logger.error('Failed to play audio.', e);
      }
    });

    player.on('stateChange', async (_, { status }) => {
      if (status === AudioPlayerStatus.Idle) {
        const nextItem = await this.playQueueService.getNextItem(
          interaction.guild.id,
        );
        if (!nextItem) {
          connection.destroy();
          this.playQueueService.destroyQueue(interaction.guild.id);
          return;
        }
        const { stream } = await streamFromYtLink(itemToPlay.url, {
          discordPlayerCompatibility: true,
        });
        const resource = createAudioResource(stream);
        player.play(resource);
      }
    });

    connection.on('error', (error) => {
      this.logger.error('An error occurred with the voice connection.', error);
      this.playQueueService.destroyQueue(interaction.guild.id);
    });
    connection.on(VoiceConnectionStatus.Disconnected, () => {
      this.playQueueService.destroyQueue(interaction.guild.id);
    });
    connection.on(VoiceConnectionStatus.Destroyed, () => {
      this.playQueueService.destroyQueue(interaction.guild.id);
    });
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
}
