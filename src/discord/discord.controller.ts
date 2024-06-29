import { Body, Controller, Logger, Post, ServiceUnavailableException, UseGuards } from '@nestjs/common';

import { PlayDto } from 'src/discord/dto';
import { DiscordInteractionHandlerService } from 'src/discord/discord.interaction.handler.service';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { UserRoles } from 'src/auth/types';
import { JwtAuthGuard } from 'src//auth/guards/jwt.auth.guard';

@Controller('discord')
export class DiscordController {
  private readonly logger = new Logger(DiscordController.name);

  constructor(private readonly discordInteractionHandlerService: DiscordInteractionHandlerService) {}

  @Post('play')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoles.admin)
  public async play(@Body() { url }: PlayDto): Promise<void> {
    try {
      await this.discordInteractionHandlerService.playFromEndpoint(url);
    } catch (e) {
      // TODO: Add sentry logging
      this.logger.error(e);
      throw new ServiceUnavailableException('An error occurred');
    }
  }
}
