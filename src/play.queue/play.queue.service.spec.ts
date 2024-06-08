import { Test, TestingModule } from '@nestjs/testing';
import { PlayQueueService } from './play.queue.service';

describe('PlayQueueService', () => {
  let service: PlayQueueService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlayQueueService],
    }).compile();

    service = module.get<PlayQueueService>(PlayQueueService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
