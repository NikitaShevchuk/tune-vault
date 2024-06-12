import { Injectable, Logger } from '@nestjs/common';
import { getVoiceConnection } from '@discordjs/voice';
import { Client, Interaction } from 'discord.js';

import { ButtonIds, Commands, commands, intents } from 'src/discord/constants';
import { DiscordInteractionService } from 'src/discord/discord.interaction.service';
import { PlayQueueService } from 'src/play.queue/play.queue.service';
import { DiscordPlayerMessageService } from 'src/discord/discord.player.message.service';

@Injectable()
export class DiscordService {
  private readonly logger = new Logger(DiscordService.name);
  private readonly client = new Client({
    intents,
  });

  constructor(
    private readonly discordHelperService: DiscordInteractionService,
    private readonly playQueueService: PlayQueueService,
    private readonly discordPlayerMessageService: DiscordPlayerMessageService,
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
        `New interaction detected. Server ID: ${interaction.guildId}. Is command: ${interaction.isCommand()}. Is button: ${interaction.isButton()}.`,
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
      this.discordPlayerMessageService.delete(interaction.guild.id);
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
      this.discordHelperService.handlePlayCommand(interaction);
    }
  }
}
