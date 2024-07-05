import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { PlayDto } from 'src/discord/dto';
import { DiscordInteractionHandlerService } from 'src/discord/discord.interaction.handler.service';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { UserRoles } from 'src/auth/types';
import { JwtAuthGuard } from 'src/auth/guards/jwt.auth.guard';
import { Guild as TuneVaultGuild } from '@prisma/client';
import { DiscordGuildService } from 'src/discord/discord.guild.service';
import { FindGuildsDto } from 'src/discord/dto/find.guilds.dto';

@Controller('discord')
export class DiscordController {
  private readonly logger = new Logger(DiscordController.name);

  constructor(
    private readonly discordInteractionHandlerService: DiscordInteractionHandlerService,
    private readonly discordGuildService: DiscordGuildService,
  ) {}

  @Get('guild')
  @UseGuards(JwtAuthGuard)
  public async getGuilds(@Query() { ids }: FindGuildsDto): Promise<TuneVaultGuild[]> {
    return this.discordGuildService.findMany(ids);
  }

  @Post('play')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoles.admin)
  public async play(@Req() request: Request, @Body() { url }: PlayDto): Promise<void> {
    try {
      await this.discordInteractionHandlerService.playFromHttp({ url, userId: request.user.id });
    } catch (e) {
      // TODO: Add sentry logging
      this.logger.error(e);
      throw new ServiceUnavailableException('An error occurred');
    }
  }
}
