import { Injectable } from '@nestjs/common';
import { Guild } from 'discord.js';
import { DbService } from 'src/db/db.service';

import { Guild as TuneVaultGuild } from '@prisma/client';

@Injectable()
export class DiscordGuildService {
  constructor(private readonly dbService: DbService) {}

  public async findMany(ids: string[]): Promise<TuneVaultGuild[]> {
    return await this.dbService.guild.findMany({ where: { id: { in: ids } } });
  }

  public async find(guildId: string): Promise<TuneVaultGuild> {
    return await this.dbService.guild.findUnique({
      where: {
        id: guildId,
      },
    });
  }

  public async getActiveGuild(userId: string): Promise<TuneVaultGuild> {
    return await this.dbService.guild.findFirst({
      where: {
        activeUsers: {
          some: {
            id: userId,
          },
        },
      },
    });
  }

  public async update(guild: Partial<TuneVaultGuild>): Promise<TuneVaultGuild> {
    return this.dbService.guild.update({
      where: {
        id: guild.id,
      },
      data: guild,
    });
  }

  public async upsert(guild: Guild): Promise<TuneVaultGuild> {
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
