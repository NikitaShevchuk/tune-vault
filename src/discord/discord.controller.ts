import { BadRequestException, Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';

import { PlayDto } from 'src/discord/dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt.auth.guard';
import { Guild as TuneVaultGuild } from '@prisma/client';
import { DiscordGuildService } from 'src/discord/discord.guild.service';
import { FindGuildsDto } from 'src/discord/dto/find.guilds.dto';
import { UserService } from 'src/user/user.service';
import { DiscordPlayerService } from './player/discord.player.service';
import { DiscordPlayerMessageService } from './player/discord.player.message.service';
import { DiscordMessageService } from './discord.message.service';
import { PlayQueueService } from 'src/play.queue/play.queue.service';

@Controller('discord')
export class DiscordController {
  // private readonly logger = new Logger(DiscordController.name);

  constructor(
    private readonly discordGuildService: DiscordGuildService,
    private readonly userService: UserService,
    private readonly discordPlayerService: DiscordPlayerService,
    private readonly discordPlayerMessageService: DiscordPlayerMessageService,
    private readonly discordMessageService: DiscordMessageService,
    private readonly playQueueService: PlayQueueService,
  ) {}

  @Get('guild')
  @UseGuards(JwtAuthGuard)
  public async getGuilds(@Query() { ids }: FindGuildsDto): Promise<TuneVaultGuild[]> {
    return this.discordGuildService.findMany(ids.split(','));
  }

  @Post('play')
  @UseGuards(JwtAuthGuard)
  public async play(@Req() request: Request, @Body() { url }: PlayDto): Promise<void> {
    const user = await this.userService.findOne(request.user.id);
    if (!user.activeGuildId) {
      throw new BadRequestException('No active guild found');
    }

    const hasItemsInTheQeue = await this.playQueueService.hasItemsInTheQueue(user.activeGuildId);
    await this.discordMessageService.displayMessage({
      message: 'Loading details...',
      interaction: undefined,
      guildId: user.activeGuildId,
      shouldDeleteAfterDelay: hasItemsInTheQeue,
    });

    const message = await this.discordPlayerService.playFromHttp({ userInput: url, userId: user.id });
    if (message) {
      await this.discordMessageService.displayMessage({
        message,
        interaction: undefined,
        guildId: user.activeGuildId,
      });
    }

    const playerState = await this.discordPlayerService.getCurrentPlayerState(user.activeGuildId);
    await this.discordPlayerMessageService.sendCurrentTrackDetails({
      interaction: undefined,
      guildId: user.activeGuildId,
      playerState,
    });
  }
}
