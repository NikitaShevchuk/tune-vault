import { Test, TestingModule } from '@nestjs/testing';

import { PlayQueueService } from 'src/play.queue/play.queue.service';
import { DbModule } from 'src/db/db.module';
import { DbService } from 'src/db/db.service';
import { TestDbService } from 'src/global/tests/db/test.db.service';
import { TestDbModule } from 'src/global/tests/db/test.db.module';

describe('PlayQueueService', () => {
  let service: PlayQueueService;
  let dbService: DbService;
  let testDbService: TestDbService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlayQueueService, DbService],
      imports: [DbModule, TestDbModule],
    }).compile();

    service = module.get<PlayQueueService>(PlayQueueService);
    dbService = module.get<DbService>(DbService);
    testDbService = module.get<TestDbService>(TestDbService);
  });

  beforeEach(async () => {
    await testDbService.createMockGuild();
    await testDbService.createMockPlayQueue();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return an existing play queue', async () => {
    const playQueue = await service.getOrCreatePlayQueue(testDbService.mockGuild.id);
    expect(playQueue.queue.length).toEqual(testDbService.mockQueueItems.length);
  });

  it('should return current item (first item with "alreadyPlayed" field = true)', async () => {
    const currentItem = await service.getCurrentItem(testDbService.mockGuild.id);
    expect(currentItem.alreadyPlayed).toEqual(true);
  });

  it('should return next item (first item with "alreadyPlayed" field = false)', async () => {
    const nextItem = await service.getNextItem({ guildId: testDbService.mockGuild.id });
    expect(nextItem.alreadyPlayed).toEqual(false);
  });

  it('should push a new item to the queue', async () => {
    const urls = ['https://some-url.com'];
    await service.pushToQueue({ guildId: testDbService.mockGuild.id, urls });
    const { queue } = await service.getOrCreatePlayQueue(testDbService.mockGuild.id);
    expect(queue.length).toEqual(testDbService.mockQueueItems.length + urls.length);
  });

  it('should return the previous item (where "alreadyPlayed" = true)', async () => {
    const prevItem = await service.getPrevItem(testDbService.mockGuild.id);
    expect(prevItem.alreadyPlayed).toEqual(true);
  });

  it('should destroy the queue', async () => {
    await service.destroyQueue(testDbService.mockGuild.id);
    const queue = await dbService.guild.findUnique({ where: { id: testDbService.mockGuild.id } }).playQueue();
    expect(queue).toEqual(null);
  });
});
