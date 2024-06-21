import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DiscordService } from 'src/discord/discord.service';
import { DiscordInteractionHandlerService } from 'src/discord/discord.interaction.handler.service';
import { YoutubeService } from 'src/youtube/youtube.service';
import { YoutubeModule } from 'src/youtube/youtube.module';
import { PlayQueueModule } from 'src/play.queue/play.queue.module';
import { PlayQueueService } from 'src/play.queue/play.queue.service';
import { DiscordAudioService } from 'src/discord/discord.audio.service';
import { DiscordPlayerMessageService } from 'src/discord/discord.player.message.service';
import { DiscordInteractionHelperService } from 'src/discord/discord.interaction.helper.service';
import { DiscordController } from 'src/discord/discord.controller';
import { DiscordClientService } from 'src/discord/discord.client.service';

@Module({
  providers: [
    DiscordService,
    DiscordInteractionHandlerService,
    YoutubeService,
    PlayQueueService,
    DiscordAudioService,
    DiscordPlayerMessageService,
    DiscordInteractionHelperService,
    DiscordClientService,
  ],
  imports: [YoutubeModule, PlayQueueModule, ConfigModule],
  controllers: [DiscordController],
})
export class DiscordModule {}
