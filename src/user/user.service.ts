import { Injectable } from '@nestjs/common';

import { UpdateUserDto } from 'src/user/dto/update-user.dto';
import { DbService } from 'src/db/db.service';
import { User as TuneVaultUser } from '@prisma/client';
import { Interaction, User } from 'discord.js';

@Injectable()
export class UserService {
  constructor(private readonly dbService: DbService) {}

  public async findAll(): Promise<TuneVaultUser[]> {
    return this.dbService.user.findMany();
  }

  public async findOne(id: string): Promise<TuneVaultUser> {
    return this.dbService.user.findUnique({
      where: { id },
    });
  }

  public async update(id: string, updateUserDto: UpdateUserDto): Promise<TuneVaultUser> {
    return this.dbService.user.update({
      where: { id },
      data: updateUserDto,
    });
  }

  public async remove(id: string): Promise<TuneVaultUser> {
    return this.dbService.user.delete({
      where: { id },
    });
  }

  public async totalCount(): Promise<number> {
    return this.dbService.user.count();
  }

  public async upsertUserFromDiscord(user: User): Promise<TuneVaultUser> {
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

  public async updateActiveGuildIdBasedOnInteraction(interaction: Interaction): Promise<void> {
    const user = (await this.findOne(interaction.user.id)) ?? (await this.upsertUserFromDiscord(interaction.user));
    const activeGuildAlreadySet = user.activeGuildId === interaction.guild.id;

    if (!activeGuildAlreadySet) {
      await this.update(user.id, {
        activeGuildId: interaction.guild.id,
      });
    }
  }
}
