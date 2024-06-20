import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, Interaction } from 'discord.js';

import { commands, intents } from 'src/discord/constants';
import { DiscordInteractionHandlerService } from 'src/discord/discord.interaction.handler.service';

@Injectable()
export class DiscordService {
  private readonly logger = new Logger(DiscordService.name);
  private readonly client = new Client({
    intents,
  });

  constructor(
    private readonly discordInteractionHandlerService: DiscordInteractionHandlerService,
    private readonly configService: ConfigService,
  ) {}

  public initialize() {
    // Handle errors
    this.client.on('error', (error) => {
      this.logger.error('An error occurred.', error);
    });

    // Login
    this.client.login(this.configService.get<string>('discord.token'));
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
      this.discordInteractionHandlerService.handleCommandInteraction(interaction);
      return;
    }
    if (interaction.isButton()) {
      this.discordInteractionHandlerService.handleButtonInteraction(interaction);
      return;
    }

    this.logger.error('Unknown interaction type.');
  }
}
