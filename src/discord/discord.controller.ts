import {
  BadRequestException,
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
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { JwtAuthGuard } from 'src/auth/guards/jwt.auth.guard';
import { Guild as TuneVaultGuild } from '@prisma/client';
import { DiscordGuildService } from 'src/discord/discord.guild.service';
import { FindGuildsDto } from 'src/discord/dto/find.guilds.dto';
import { UserService } from 'src/user/user.service';
import { DiscordPlayerService } from './player/discord.player.service';

@Controller('discord')
export class DiscordController {
  private readonly logger = new Logger(DiscordController.name);

  constructor(
    private readonly discordGuildService: DiscordGuildService,
    private readonly userService: UserService,
    private readonly disocrdPlayerService: DiscordPlayerService,
  ) {}

  @Get('guild')
  @UseGuards(JwtAuthGuard)
  public async getGuilds(@Query() { ids }: FindGuildsDto): Promise<TuneVaultGuild[]> {
    return this.discordGuildService.findMany(ids.split(','));
  }

  @Post('play')
  @UseGuards(JwtAuthGuard, RolesGuard)
  public async play(@Req() request: Request, @Body() { url }: PlayDto): Promise<void> {
    try {
      const user = await this.userService.findOne(request.user.id);
      if (!user.activeGuildId) {
        throw new BadRequestException('No active guild found');
      }
      await this.disocrdPlayerService.playFromHttp({ url, userId: user.id });
    } catch (e) {
      // TODO: Add sentry logging
      this.logger.error(e);
      throw new ServiceUnavailableException('An error occurred');
    }
  }
}
