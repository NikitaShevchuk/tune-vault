import { ConfigService } from '@nestjs/config';
import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';

import { DiscordService } from 'src/discord/discord.service';
import { Transformers } from 'src/utils/transformers';
import { AuthService } from 'src/auth/auth.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt.auth.guard';
import { User as TuneVaultUser } from '@prisma/client';
import { UserService } from 'src/user/user.service';
import { Configuration } from 'src/config/configuration';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly discordService: DiscordService,
    private readonly configService: ConfigService<Configuration>,
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  @Get('')
  @UseGuards(AuthGuard('discord'))
  public async auth(): Promise<void> {}

  @Get('callback')
  @UseGuards(AuthGuard('discord'))
  public async discordLoginCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.discordService.upsertUser(Transformers.snakeCaseToCamelCase(req.user));

    const jwt = await this.authService.generateJwt(req.user);
    const isProduction = this.configService.get('environment') === 'production';
    res.cookie('token', jwt.access_token, { secure: isProduction });

    return res.redirect(`${this.configService.get('uiUrl')}/after-auth`);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  public async me(@Req() req: Request): Promise<TuneVaultUser> {
    return await this.userService.findOne(req.user.id);
  }

  @Get('logout')
  @UseGuards(JwtAuthGuard)
  public async logout(@Req() req: Request, @Res() res: Response) {
    req.logout({ keepSessionInfo: false }, () => res.clearCookie('jwt'));
    res.redirect(this.configService.get('uiUrl'));
  }
}
