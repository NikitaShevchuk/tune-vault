import { Injectable } from '@nestjs/common';
import { Analytics } from 'src/analytics/types';
import { DiscordGuildService } from 'src/discord/discord.guild.service';
import { UserService } from 'src/user/user.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly userService: UserService,
    private readonly discordGuildService: DiscordGuildService,
  ) {}

  public async getAnalytics(): Promise<Analytics> {
    const totalUsers = await this.userService.totalCount();
    const totalGuilds = await this.discordGuildService.totalCount();

    return {
      totalUsers,
      totalGuilds,
    };
  }
}
