import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { DbModule } from 'src/db/db.module';
import { UserModule } from 'src/user/user.module';
import { DiscordModule } from 'src/discord/discord.module';

@Module({
  providers: [AnalyticsService],
  imports: [DbModule, UserModule, DiscordModule],
})
export class AnalyticsModule {}
