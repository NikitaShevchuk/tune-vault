import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { commands } from 'src/discord/constants';
import { DiscordClientService } from 'src/discord/discord.client.service';
import { DiscordGuildService } from 'src/discord/discord.guild.service';
import { DiscordInteractionHandlerService } from 'src/discord/discord.interaction.handler.service';

@Injectable()
export class DiscordService {
  private readonly logger = new Logger(DiscordService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly discordClientService: DiscordClientService,
    private readonly discordInteractionHandlerService: DiscordInteractionHandlerService,
    private readonly discordGuildService: DiscordGuildService,
  ) {}

  /**
   * Should only be invoked once the application starts
   */
  public initialize() {
    // Handle errors
    this.discordClientService.client.on('error', (error) => {
      this.logger.error('An error occurred.', error);
    });

    // Set commands and save guild (server) to db when joining a server
    this.discordClientService.client.on('guildCreate', async (guild) => {
      this.logger.log(`👋 Joined server: ${guild.name}`);
      await guild.commands.set(commands);
      await this.discordGuildService.upsert(guild);
    });

    // Handle interactions
    this.discordClientService.client.on('interactionCreate', (i) => {
      try {
        this.discordInteractionHandlerService.handleInteraction(i);
      } catch (e) {
        // TODO add Sentry loggin
        this.logger.error('Failed to handle the interaction', e);
      }
    });

    // Login
    this.discordClientService.client.login(this.configService.get<string>('discord.token'));
    this.discordClientService.client.on('ready', () => {
      this.logger.log(`🚀 Logged in as 🟢${this.discordClientService.client.user.tag}`);
    });
  }
}
