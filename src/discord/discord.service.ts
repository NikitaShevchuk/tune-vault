import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DiscordClientService } from 'src/discord/discord.client.service';
import { DbService } from 'src/db/db.service';
import { commands } from 'src/discord/constants';
import { DiscordInteractionHandlerService } from 'src/discord/discord.interaction.handler.service';
import { Guild as TuneVaultGuild } from '@prisma/client';
import { Guild } from 'discord.js';

@Injectable()
export class DiscordService {
  private readonly logger = new Logger(DiscordService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly discordClientService: DiscordClientService,
    private readonly dbService: DbService,
    private readonly discordInteractionHandlerService: DiscordInteractionHandlerService,
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
      await this.upsertGuild(guild);
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

  private async upsertGuild(guild: Guild): Promise<TuneVaultGuild> {
    return await this.dbService.guild.upsert({
      create: {
        id: guild.id,
        name: guild.name,
        joinedAt: guild.joinedAt,
      },
      update: {
        name: guild.name,
        joinedAt: guild.joinedAt,
      },
      where: {
        id: guild.id,
      },
    });
  }
}
