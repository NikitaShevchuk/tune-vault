import { Injectable } from '@nestjs/common';
import { Guild, Interaction, TextChannel } from 'discord.js';
import { DbService } from 'src/db/db.service';

import { Guild as TuneVaultGuild } from '@prisma/client';
import { DiscordClientService } from './discord.client.service';
import { InteractionOrUserId } from './types';

@Injectable()
export class DiscordGuildService {
  constructor(
    private readonly dbService: DbService,
    private readonly discordClientService: DiscordClientService,
  ) {}

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
        icon: guild.icon,
      },
      update: {
        name: guild.name,
        joinedAt: guild.joinedAt,
        icon: guild.icon,
      },
      where: {
        id: guild.id,
      },
    });
  }

  public async totalCount(): Promise<number> {
    return await this.dbService.guild.count();
  }

  public async getActiveTextChannel(userId: string): Promise<TextChannel | null> {
    const userActiveGuild = await this.getActiveGuild(userId);
    const guild = await this.discordClientService.client.guilds.fetch(userActiveGuild.id);

    // Try to get the active channel saved in the database
    if (userActiveGuild.activeChannelId) {
      const channel = await guild.channels.fetch(userActiveGuild.activeChannelId);
      if (!channel.isTextBased()) {
        return null;
      }
      return channel as TextChannel;
    }

    // Fallback to the first text channel in the guild
    const channels = await guild.channels.fetch();
    const textChannel = channels.find((channel) => channel.isTextBased()) as TextChannel;
    if (!textChannel) {
      return null;
    }
    await this.update({ ...userActiveGuild, activeChannelId: textChannel.id });
    return textChannel;
  }

  public async updateActiveGuildBasedOnInteraction(interaction: Interaction): Promise<void> {
    const tuenVaultGuild = (await this.find(interaction.guild.id)) ?? (await this.upsert(interaction.guild));
    const activeChannelAlreadySet = tuenVaultGuild.activeChannelId === interaction.channel.id;

    if (!activeChannelAlreadySet) {
      await this.update({
        id: interaction.guild.id,
        activeChannelId: interaction.channel.id,
      });
    }
  }

  public async getActiveGuildId({ userId, interaction }: InteractionOrUserId) {}
}
