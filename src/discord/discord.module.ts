import { Module } from '@nestjs/common';

import { DiscordService } from 'src/discord/discord.service';
import { DiscordInteractionService } from 'src/discord/discord.interaction.service';
import { YoutubeService } from 'src/youtube/youtube.service';
import { YoutubeModule } from 'src/youtube/youtube.module';
import { PlayQueueModule } from 'src/play.queue/play.queue.module';
import { PlayQueueService } from 'src/play.queue/play.queue.service';
import { DiscordAudioService } from 'src/discord/discord.audio.service';
import { DiscordPlayerMessageService } from 'src/discord/discord.player.message.service';

@Module({
  providers: [
    DiscordService,
    DiscordInteractionService,
    YoutubeService,
    PlayQueueService,
    DiscordAudioService,
    DiscordPlayerMessageService,
  ],
  imports: [YoutubeModule, PlayQueueModule],
})
export class DiscordModule {}
