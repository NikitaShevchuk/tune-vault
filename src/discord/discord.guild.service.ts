import { Injectable } from '@nestjs/common';
import { Guild } from 'discord.js';
import { DbService } from 'src/db/db.service';

import { Guild as TuneVaultGuild } from '@prisma/client';

@Injectable()
export class DiscordGuildService {
  constructor(private readonly dbService: DbService) {}

  public async updateActiveChannelId(guildId: string, channelId: string): Promise<void> {
    await this.dbService.guild.update({
      where: {
        id: guildId,
      },
      data: {
        activeChannelId: channelId,
      },
    });
  }

  public async getActiveGuild(userId: string): Promise<TuneVaultGuild> {
    return await this.dbService.guild.findFirstOrThrow({
      where: {
        activeUsers: {
          some: {
            id: userId,
          },
        },
      },
    });
  }

  public async upsertGuild(guild: Guild): Promise<TuneVaultGuild> {
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
