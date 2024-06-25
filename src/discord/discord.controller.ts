import { Body, Controller, Logger, Post, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';

import { PlayDto, AuthDto } from 'src/discord/dto';
import { DiscordInteractionHandlerService } from 'src/discord/discord.interaction.handler.service';
import { DiscordService } from 'src/discord//discord.service';
import { Transformers } from 'src/utils/transformers';
import { User as TuneVaultUser } from '@prisma/client';

@Controller('discord')
export class DiscordController {
  private readonly logger = new Logger(DiscordController.name);

  constructor(
    private readonly discordInteractionHandlerService: DiscordInteractionHandlerService,
    private readonly discordService: DiscordService,
  ) {}

  @Post('play')
  public async play(@Body() { url }: PlayDto): Promise<void> {
    try {
      await this.discordInteractionHandlerService.playFromEndpoint(url);
    } catch (e) {
      // TODO: Add sentry logging
      this.logger.error(e);
      throw new ServiceUnavailableException('An error occurred');
    }
  }

  @Post('auth')
  public async auth(@Body() { token }: AuthDto): Promise<TuneVaultUser> {
    try {
      const { tokenIsValid, user } = await this.discordService.validateTokenAndGetDiscordUser(token);
      if (!tokenIsValid) {
        throw new UnauthorizedException('Invalid token');
      }

      return await this.discordService.upsertUser(Transformers.snakeCaseToCamelCase(user));
    } catch (e) {
      // TODO: Add sentry logging
      this.logger.error(e);
      throw new ServiceUnavailableException('An error occurred');
    }
  }
}
