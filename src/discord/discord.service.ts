import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from 'discord.js';

import { User as TuneVaultUser } from '@prisma/client';
import { DbService } from 'src/db/db.service';
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
    private readonly dbService: DbService,
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
      await this.discordGuildService.upsertGuild(guild);
    });

    // Handle interactions
    this.discordClientService.client.on('interactionCreate', (i) =>
      this.discordInteractionHandlerService.handleInteraction(i),
    );

    // Login
    this.discordClientService.client.login(this.configService.get<string>('discord.token'));
    this.discordClientService.client.on('ready', () => {
      this.logger.log(`🚀 Logged in as 🟢${this.discordClientService.client.user.tag}`);
    });
  }

  public async upsertUser(user: User): Promise<TuneVaultUser> {
    return await this.dbService.user.upsert({
      create: {
        id: user.id,
        username: user.username,
        bot: user.bot ?? false,
        createdAt: new Date(),
        globalName: user.globalName,
        avatar: user.avatar,
      },
      update: {
        username: user.username,
        bot: user.bot ?? false,
        globalName: user.globalName,
        avatar: user.avatar,
      },
      where: {
        id: user.id,
      },
    });
  }
}
