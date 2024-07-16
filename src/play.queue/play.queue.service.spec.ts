import { Test, TestingModule } from '@nestjs/testing';
import { CacheModule } from '@nestjs/cache-manager';

import { PlayQueueService } from 'src/play.queue/play.queue.service';
import { redisOptions } from 'src/db/redis-options';
import { DbModule } from 'src/db/db.module';
import { DbService } from 'src/db/db.service';
import { PlayQueueType } from './types';
import { Guild } from '@prisma/client';

describe('PlayQueueService', () => {
  let service: PlayQueueService;
  let dbService: DbService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlayQueueService, DbService],
      imports: [DbModule, CacheModule.registerAsync(redisOptions)],
    }).compile();

    service = module.get<PlayQueueService>(PlayQueueService);
    dbService = module.get<DbService>(DbService);
  });

  const testQueueItems: PlayQueueType = [
    { url: 'https://test.com', alreadyPlayed: true },
    { url: 'https://test.com', alreadyPlayed: true },
    { url: 'https://test.com', alreadyPlayed: false },
  ];
  const testGuildPlayload: Partial<Guild> = { id: 'testId', name: 'testName', joinedAt: new Date() };

  beforeEach(async () => {
    await dbService.guild.deleteMany();
    await dbService.playQueue.deleteMany();
    const testGuild = await dbService.guild.create({ data: testGuildPlayload as Guild });
    await dbService.playQueue.create({ data: { queue: testQueueItems, guildId: testGuild.id } });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return an existing play queue', async () => {
    const playQueue = await service.getOrCreatePlayQueue(testGuildPlayload.id);
    expect(playQueue.queue.length).toEqual(testQueueItems.length);
  });

  it('should return current item (first item with "alreadyPlayed" field = true)', async () => {
    const currentItem = await service.getCurrentItem(testGuildPlayload.id);
    expect(currentItem.alreadyPlayed).toEqual(true);
  });

  it('should return next item (first item with "alreadyPlayed" field = false)', async () => {
    const nextItem = await service.getNextItem({ guildId: testGuildPlayload.id });
    expect(nextItem.alreadyPlayed).toEqual(false);
  });

  it('should push a new item to the queue', async () => {
    const urls = ['https://some-url.com'];
    await service.pushToQueue({ guildId: testGuildPlayload.id, urls });
    const { queue } = await service.getOrCreatePlayQueue(testGuildPlayload.id);
    expect(queue.length).toEqual(testQueueItems.length + urls.length);
  });

  it('should return the previous item (where "alreadyPlayed" = true)', async () => {
    const prevItem = await service.getPrevItem(testGuildPlayload.id);
    expect(prevItem.alreadyPlayed).toEqual(true);
  });

  it('should destroy the queue', async () => {
    await service.destroyQueue(testGuildPlayload.id);
    const queue = await dbService.guild.findUnique({ where: { id: testGuildPlayload.id } }).playQueue();
    expect(queue).toEqual(null);
  });
});
