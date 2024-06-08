import { Module } from '@nestjs/common';

import { DiscordService } from 'src/discord/discord.service';
import { DiscordHelperService } from 'src/discord/discord.helper.service';
import { YoutubeService } from 'src/youtube/youtube.service';
import { YoutubeModule } from 'src/youtube/youtube.module';
import { PlayQueueModule } from 'src/play.queue/play.queue.module';
import { PlayQueueService } from 'src/play.queue/play.queue.service';

@Module({
  providers: [
    DiscordService,
    DiscordHelperService,
    YoutubeService,
    PlayQueueService,
  ],
  imports: [YoutubeModule, PlayQueueModule],
})
export class DiscordModule {}
