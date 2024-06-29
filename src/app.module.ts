import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';

import { AppController } from 'src/app.controller';
import { AppService } from 'src/app.service';
import { PlayQueueModule } from 'src/play.queue/play.queue.module';
import configuration from 'src/config/configuration';
import { validate } from 'src/config/env.validation';
import { DbModule } from 'src/db/db.module';
import { UserModule } from 'src/user/user.module';
import { redisOptions } from 'src/db/redis-options';
import { DiscordModule } from 'src/discord/discord.module';
import { YoutubeModule } from 'src/youtube/youtube.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ load: [configuration], validate }),
    CacheModule.registerAsync(redisOptions),
    DiscordModule,
    YoutubeModule,
    PlayQueueModule,
    DbModule,
    UserModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
