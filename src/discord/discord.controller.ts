import { Body, Controller, Post } from '@nestjs/common';
import { PlayDto } from 'src/discord/dto/play.dto';
import { DiscordInteractionHandlerService } from './discord.interaction.handler.service';

@Controller('discord')
export class DiscordController {
  constructor(private readonly discordInteractionHandlerService: DiscordInteractionHandlerService) {}

  @Post('play')
  public async play(@Body() { url }: PlayDto): Promise<void> {
    // this.discordInteractionHandlerService.playFromUrl(url);
  }
}
