import { Controller, Get } from '@nestjs/common';
import { AnalyticsService } from 'src/analytics/analytics.service';
import { Analytics } from 'src/analytics/types';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('')
  public async getAnalytics(): Promise<Analytics> {
    return await this.analyticsService.getAnalytics();
  }
}
