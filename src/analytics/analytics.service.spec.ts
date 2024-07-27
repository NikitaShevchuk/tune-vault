import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { TestDbModule } from 'src/global/tests/db/test.db.module';
import { TestDbService } from 'src/global/tests/db/test.db.service';
import { AnalyticsModule } from './analytics.module';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let testDbService: TestDbService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestDbModule, AnalyticsModule],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    testDbService = module.get<TestDbService>(TestDbService);
  });

  beforeEach(async () => {
    await testDbService.createMockGuild(2);
    await testDbService.createMockUser(2);
  });
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should calculate the analytics', async () => {
    const { totalGuilds, totalUsers } = await service.getAnalytics();
    expect(totalGuilds).toEqual(2);
    expect(totalUsers).toEqual(2);
  });
});
