import { Test, TestingModule } from '@nestjs/testing';
import { DiscordService } from './discord.service';
import { DiscordModule } from './discord.module';
import { CacheModule } from '@nestjs/cache-manager';
import { DbModule } from 'src/db/db.module';
import { redisOptions } from 'src/db/redis-options';

describe('DiscordService', () => {
  let service: DiscordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DiscordModule, DbModule, CacheModule.registerAsync(redisOptions), DiscordModule],
      controllers: [],
    }).compile();

    service = module.get<DiscordService>(DiscordService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
