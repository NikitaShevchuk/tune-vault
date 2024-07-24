import { ConfigService } from '@nestjs/config';
import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CookieOptions, Request, Response } from 'express';

import { Transformers } from 'src/utils/transformers';
import { AuthService } from 'src/auth/auth.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt.auth.guard';
import { UserService } from 'src/user/user.service';
import { Configuration } from 'src/config/configuration';

@Controller('auth')
export class AuthController {
  constructor(
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
    await this.userService.upsertUserFromDiscord(Transformers.snakeCaseToCamelCase(req.user));

    const jwt = await this.authService.generateJwt(req.user);
    const uiUrl = this.configService.get('uiUrl');
    const cookie10DaysMaxAge = 864_000_000;

    const cookieOptions: CookieOptions = {
      secure: true,
      path: '/',
      sameSite: 'none',
      maxAge: cookie10DaysMaxAge,
      // Fronted and backend have different domains so it won't work for now
      // const uiHost = this.configService.get('uiHost');
      // domain: uiHost,
    };
    res.cookie('token', jwt.access_token, cookieOptions);
    // The instance of user here comes from the passport strategy, which is not the same as the user in the database
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    res.cookie('discord-token', req.user.accessToken, cookieOptions);

    return res.redirect(`${uiUrl}/after-auth`);
  }

  @Get('logout')
  @UseGuards(JwtAuthGuard)
  public async logout(@Req() req: Request, @Res() res: Response) {
    req.logout({ keepSessionInfo: false }, () => res.clearCookie('jwt'));
    res.redirect(this.configService.get('uiUrl'));
  }
}
