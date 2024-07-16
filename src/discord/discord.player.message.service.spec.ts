import { Test, TestingModule } from '@nestjs/testing';
import { DiscordModule } from './discord.module';
import { DbModule } from 'src/db/db.module';
import { DiscordPlayerMessageService } from './discord.player.message.service';
import { TestDbModule } from 'src/global/tests/db/test.db.module';
import { TestDbService } from 'src/global/tests/db/test.db.service';

describe('DiscordPlayerMessageService', () => {
  let service: DiscordPlayerMessageService;
  let testDbService: TestDbService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DiscordModule, DbModule, TestDbModule],
    }).compile();

    service = module.get<DiscordPlayerMessageService>(DiscordPlayerMessageService);
    testDbService = module.get<TestDbService>(TestDbService);
  });

  beforeEach(async () => {
    await testDbService.createMockGuild();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return the active message id ', async () => {
    expect(await service.get(testDbService.mockGuild.id)).toBeDefined();
  });

  it('should delete active message id', async () => {
    await service.delete(testDbService.mockGuild.id);
    expect(await service.get(testDbService.mockGuild.id)).toEqual(null);
  });
});
