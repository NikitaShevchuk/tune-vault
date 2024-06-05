import { Injectable, Logger } from '@nestjs/common';
import {
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
  EmbedBuilder,
  GuildMember,
  Interaction,
  MessageActionRowComponentBuilder,
} from 'discord.js';
import {
  stream as streamFromYtLink,
  video_info as getVideoInfo,
} from 'play-dl';

import { ButtonIds, Commands, commands, intents } from 'src/discord/constants';
import { DiscordHelperService } from 'src/discord/discord.helper.service';

@Injectable()
export class DiscordService {
  private readonly logger = new Logger(DiscordService.name);
  private readonly client = new Client({
    intents,
  });

  constructor(private readonly discordHelperService: DiscordHelperService) {}

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
        this.handleCommand(interaction);
        return;
      }
      if (interaction.isButton()) {
        this.logger.log('Button interaction detected.');
        this.handleButton(interaction);
        return;
      }

      throw new Error('Unknown interaction type');
    } catch (e) {
      this.logger.error('Failed to handle an interaction.', e);
    }
  }

  private handleButton(interaction: Interaction): void {
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
      connection.destroy();
      interaction.reply('Disconnected');
    }
  }

  private async handleCommand(interaction: Interaction): Promise<void> {
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
    if (!this.discordHelperService.validateUserInput(userInput)) {
      await interaction.reply('⛔ Invalid link');
      return;
    }

    this.playAudioFromUserInput(interaction, userInput);

    await interaction.reply('Loading details...');
    const embedVideoInfo = await this.getEmbedVideoInfo(userInput);
    const actionsRow = this.getActionRow();
    await interaction.editReply({
      embeds: [embedVideoInfo],
      content: '',
      components: [actionsRow],
    });
  }

  private playAudioFromUserInput(
    interaction: Interaction,
    userInput: string,
  ): void {
    const connection = joinVoiceChannel({
      channelId: (interaction.member as GuildMember).voice.channel.id,
      guildId: interaction.guild.id,
      adapterCreator: interaction.guild.voiceAdapterCreator,
    });

    connection.on('error', (error) => {
      this.logger.error('An error occurred with the connection.', error);
    });
    connection.on(VoiceConnectionStatus.Ready, async () => {
      const player = createAudioPlayer();
      const { stream } = await streamFromYtLink(userInput, {
        discordPlayerCompatibility: true,
      });
      const resource = createAudioResource(stream);

      connection.subscribe(player);

      try {
        player.play(resource);
      } catch (e) {
        this.logger.error('Failed to play audio.', e);
      }
    });
  }

  private async getEmbedVideoInfo(userInput: string): Promise<EmbedBuilder> {
    const { video_details: videoInfo } = await getVideoInfo(userInput);
    const thumbnail = videoInfo.thumbnails.at(-1).url;
    const authorThumbnail = videoInfo.channel.icons.at(-1).url;

    return new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(`${videoInfo.title}`)
      .setURL(videoInfo.url)
      .setAuthor({
        name: videoInfo.channel.name,
        iconURL: authorThumbnail,
        url: videoInfo.channel.url,
      })
      .setThumbnail(thumbnail)
      .setDescription(
        `▶︎ ${this.discordHelperService.formatDuration(videoInfo.durationInSec)} •၊၊||။‌‌‌‌‌၊|•`,
      );
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
      .setStyle(ButtonStyle.Danger);

    return new ActionRowBuilder().addComponents(
      prevButton,
      playButton,
      nextButton,
      disconnectButton,
    ) as ActionRowBuilder<MessageActionRowComponentBuilder>;
  }
}
