import { Test, TestingModule } from '@nestjs/testing';
import { DiscordService } from './discord.service';
import { DiscordModule } from './discord.module';
import { DbModule } from 'src/db/db.module';

describe('DiscordService', () => {
  let service: DiscordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DiscordModule, DbModule, DiscordModule],
      controllers: [],
    }).compile();

    service = module.get<DiscordService>(DiscordService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
