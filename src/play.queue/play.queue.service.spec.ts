import { Test, TestingModule } from '@nestjs/testing';
import { CacheModule } from '@nestjs/cache-manager';

import { PlayQueueService } from './play.queue.service';
import { redisOptions } from 'src/db/redis-options';
import { DbModule } from 'src/db/db.module';

describe('PlayQueueService', () => {
  let service: PlayQueueService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlayQueueService],
      imports: [DbModule, CacheModule.registerAsync(redisOptions)],
    }).compile();

    service = module.get<PlayQueueService>(PlayQueueService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
