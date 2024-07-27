import { Injectable } from '@nestjs/common';
import { Guild, User } from '@prisma/client';
import { UserRoles } from 'src/auth/types';
import { DbService } from 'src/db/db.service';
import { PlayQueueType } from 'src/play.queue/types';

@Injectable()
export class TestDbService {
  constructor(private readonly dbService: DbService) {}

  public readonly mockGuild: Partial<Guild> = {
    id: 'testId',
    name: 'testName',
    joinedAt: new Date(),
    activeMessageId: 'testId',
  };
  public readonly mockUser: Partial<User> = {
    id: 'testId',
    globalName: 'testGlobalName',
    bot: false,
    role: UserRoles.user,
    username: 'testUsername',
    avatar: 'someAvatar',
    createdAt: new Date(),
  };
  public readonly mockQueueItems: PlayQueueType = [
    { url: 'https://test.com', alreadyPlayed: true },
    { url: 'https://test.com', alreadyPlayed: true },
    { url: 'https://test.com', alreadyPlayed: false },
  ];

  public async createMockGuild(count?: number): Promise<void> {
    await this.dbService.guild.deleteMany();

    if (count) {
      const mockGuilds = Array.from({ length: count }).map(
        (_, i) =>
          ({
            ...this.mockGuild,
            id: this.mockGuild.id + i,
            activeChannelId: this.mockGuild.activeChannelId + 1,
            activeMessageId: this.mockGuild.activeMessageId + i,
          }) as Guild,
      );
      await this.dbService.guild.createMany({ data: mockGuilds });
      return;
    }

    await this.dbService.guild.create({ data: this.mockGuild as Guild });
  }

  public async createMockPlayQueue(): Promise<void> {
    await this.dbService.playQueue.deleteMany();
    await this.dbService.playQueue.create({
      data: { queue: this.mockQueueItems, guildId: this.mockGuild.id },
    });
  }
  public async createMockUser(count?: number): Promise<void> {
    await this.dbService.user.deleteMany();

    if (count) {
      const mockUsers = Array.from({ length: count }).map(
        (_, i) =>
          ({
            ...this.mockUser,
            id: this.mockUser.id + i,
          }) as User,
      );
      await this.dbService.user.createMany({ data: mockUsers });
      return;
    }

    await this.dbService.guild.create({ data: this.mockGuild as Guild });
  }
}
