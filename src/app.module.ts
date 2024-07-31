import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from 'src/app.controller';
import { AppService } from 'src/app.service';
import { PlayQueueModule } from 'src/play.queue/play.queue.module';
import configuration from 'src/config/configuration';
import { validate } from 'src/config/env.validation';
import { DbModule } from 'src/db/db.module';
import { UserModule } from 'src/user/user.module';
import { DiscordModule } from 'src/discord/discord.module';
import { YoutubeModule } from 'src/youtube/youtube.module';
import { AuthModule } from 'src/auth/auth.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SocketGateway } from './socket/socket.gateway';

@Module({
  imports: [
    ConfigModule.forRoot({ load: [configuration], validate }),
    DiscordModule,
    YoutubeModule,
    PlayQueueModule,
    DbModule,
    UserModule,
    AuthModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [AppService, SocketGateway],
})
export class AppModule {}
