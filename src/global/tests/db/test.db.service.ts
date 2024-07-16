import { Injectable } from '@nestjs/common';
import { Guild } from '@prisma/client';
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
  public readonly mockQueueItems: PlayQueueType = [
    { url: 'https://test.com', alreadyPlayed: true },
    { url: 'https://test.com', alreadyPlayed: true },
    { url: 'https://test.com', alreadyPlayed: false },
  ];

  public async createMockGuild(): Promise<void> {
    await this.dbService.guild.deleteMany();
    await this.dbService.guild.create({ data: this.mockGuild as Guild });
  }

  public async createMockPlayQueue(): Promise<void> {
    await this.dbService.playQueue.deleteMany();
    await this.dbService.playQueue.create({
      data: { queue: this.mockQueueItems, guildId: this.mockGuild.id },
    });
  }
}
