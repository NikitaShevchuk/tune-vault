import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { Strategy, Profile } from 'passport-discord';
import { ConfigService } from '@nestjs/config';

import { Configuration } from 'src/config/configuration';

@Injectable()
export class DiscordStrategy extends PassportStrategy(Strategy, 'discord') {
  constructor(private readonly configService: ConfigService<Configuration, true>) {
    super({
      clientID: configService.get('discord.clientId', { infer: true }),
      clientSecret: configService.get('discord.clientSecret', { infer: true }),
      callbackURL: configService.get('discord.redirectUrl', { infer: true }),
      scope: ['identify'],
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: Profile, done: (error: any, user?: any) => void) {
    done(null, profile);
  }
}
