import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';

import { AppController } from 'src/app.controller';
import { AppService } from 'src/app.service';
import { DiscordModule } from 'src/discord/discord.module';
import { YoutubeService } from 'src/youtube/youtube.service';
import { YoutubeModule } from 'src/youtube/youtube.module';
import { redisOptions } from 'src/db/redis-options';
import { PlayQueueModule } from './play.queue/play.queue.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    CacheModule.registerAsync(redisOptions),
    DiscordModule,
    YoutubeModule,
    PlayQueueModule,
  ],
  controllers: [AppController],
  providers: [AppService, YoutubeService],
})
export class AppModule {}
