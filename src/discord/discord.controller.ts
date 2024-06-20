import { Controller, Post } from '@nestjs/common';

@Controller('discord')
export class DiscordController {
  @Post('play')
  public async play(): Promise<void> {}
}
