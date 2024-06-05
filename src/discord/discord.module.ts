import { Module } from '@nestjs/common';
import { DiscordService } from './discord.service';
import { DiscordHelperService } from './discord.helper.service';

@Module({
  providers: [DiscordService, DiscordHelperService],
})
export class DiscordModule {}
