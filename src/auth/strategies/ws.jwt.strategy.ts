import { Injectable } from '@nestjs/common';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { User } from 'discord.js';

import { Configuration } from 'src/config/configuration';
import { UserService } from 'src/user/user.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'ws-jwt') {
  constructor(
    private readonly configService: ConfigService<Configuration, true>,
    private readonly userService: UserService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwtSecret', { infer: true }),
    });
  }

  public async validate(payload: User) {
    return await this.userService.findOne(payload.id);
  }
}
