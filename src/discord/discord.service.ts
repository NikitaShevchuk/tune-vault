import { Injectable, Logger } from '@nestjs/common';
import { Client, Interaction } from 'discord.js';

import { ButtonIds, Commands, commands, intents } from 'src/discord/constants';
import { DiscordInteractionService } from 'src/discord/discord.interaction.service';
import { DiscordAudioService } from './discord.audio.service';

@Injectable()
export class DiscordService {
  private readonly logger = new Logger(DiscordService.name);
  private readonly client = new Client({
    intents,
  });

  constructor(
    private readonly discordInteractionService: DiscordInteractionService,
    private readonly discordAudioService: DiscordAudioService,
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
      this.discordInteractionService.disconnectVoiceChannel(interaction);
    }
  }

  private async handleCommandInteraction(interaction: Interaction): Promise<void> {
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
      this.discordInteractionService.handlePlayCommand(interaction);
    }
  }
}
