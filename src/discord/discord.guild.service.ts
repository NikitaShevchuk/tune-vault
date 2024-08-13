import { Injectable } from '@nestjs/common';
import { ButtonInteraction, CommandInteraction, Guild, Interaction, TextChannel } from 'discord.js';
import { DbService } from 'src/db/db.service';

import { Guild as TuneVaultGuild } from '@prisma/client';
import { DiscordClientService } from './discord.client.service';
import { InteractionOrUserId } from './types';
import { NoTextChannelFound } from './exceptions';

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

  public async getActiveTextChannelByUserId(userId: string): Promise<TextChannel> {
    const userActiveGuild = await this.getActiveGuild(userId);
    return await this.getActiveTextChannelFromGuild(userActiveGuild);
  }

  public async getActiveTextChannelByGuildId(guildId: string): Promise<TextChannel> {
    const tuneVaultGuild = await this.find(guildId);
    return await this.getActiveTextChannelFromGuild(tuneVaultGuild);
  }

  private async getActiveTextChannelFromGuild(tuneVaultGuild: TuneVaultGuild): Promise<TextChannel> {
    const discordGuild = await this.discordClientService.client.guilds.fetch(tuneVaultGuild.id);

    if (tuneVaultGuild.activeChannelId) {
      return await this.fetchTextBasedChannelById(discordGuild, tuneVaultGuild.activeChannelId);
    }

    const textChannel = await this.fetchAnyTextBasedChannelFromGuild(discordGuild);
    await this.update({ ...tuneVaultGuild, activeChannelId: textChannel.id });
    return textChannel;
  }

  private async fetchAnyTextBasedChannelFromGuild(discordGuild: Guild): Promise<TextChannel> {
    const channels = await discordGuild.channels.fetch();
    const textChannel = channels.find((channel) => channel.isTextBased()) as TextChannel;
    if (!textChannel) {
      throw new NoTextChannelFound(
        '"activeChannelId" saved in the DB is not text-based for guild with id: ',
        discordGuild.id,
      );
    }
    return textChannel;
  }

  private async fetchTextBasedChannelById(discordGuild: Guild, channelId: string): Promise<TextChannel> {
    const channel = await discordGuild.channels.fetch(channelId);
    if (!channel.isTextBased()) {
      throw new NoTextChannelFound(
        '"activeChannelId" saved in the DB is not text-based for guild with id: ',
        discordGuild.id,
      );
    }
    return channel as TextChannel;
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

  public async getActiveGuildId({ userId, interaction }: InteractionOrUserId<ButtonInteraction | CommandInteraction>) {
    return interaction ? interaction.guild.id : (await this.getActiveGuild(userId))?.id;
  }
}
