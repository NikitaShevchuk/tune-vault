import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

import { PlayQueueModule } from 'src/play.queue/play.queue.module';
import { PlayQueueService } from 'src/play.queue/play.queue.service';
import { YoutubeModule } from 'src/youtube/youtube.module';
import { YoutubeService } from 'src/youtube/youtube.service';
import { DiscordAudioService } from 'src/discord/discord.audio.service';
import { DiscordClientService } from 'src/discord/discord.client.service';
import { DiscordController } from 'src/discord/discord.controller';
import { DiscordGuildService } from 'src/discord/discord.guild.service';
import { DiscordInteractionHandlerService } from 'src/discord/discord.interaction.handler.service';
import { DiscordMessageService } from 'src/discord/discord.message.service';
import { DiscordPlayerMessageService } from 'src/discord/discord.player.message.service';
import { DiscordService } from 'src/discord/discord.service';
import { UserModule } from 'src/user/user.module';

@Module({
  providers: [
    DiscordService,
    DiscordInteractionHandlerService,
    YoutubeService,
    PlayQueueService,
    DiscordAudioService,
    DiscordPlayerMessageService,
    DiscordMessageService,
    DiscordClientService,
    DiscordGuildService,
  ],
  imports: [YoutubeModule, PlayQueueModule, ConfigModule, HttpModule, UserModule],
  controllers: [DiscordController],
  exports: [DiscordService],
})
export class DiscordModule {}
