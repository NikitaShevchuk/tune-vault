import { HttpModule } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthService } from 'src/auth/auth.service';
import { DiscordStrategy } from 'src/auth/strategies/discord.auth.strategy';
import { AuthController } from 'src/auth/auth.controller';
import { DiscordModule } from 'src/discord/discord.module';
import { Configuration } from 'src/config/configuration';
import { UserModule } from 'src/user/user.module';
import { JwtStrategy } from 'src/auth/strategies/jwt.strategy';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: async (configService: ConfigService<Configuration>) => ({
        secret: configService.get('jwtSecret', { infer: true }),
        signOptions: { expiresIn: '10 days' },
      }),
      inject: [ConfigService],
      imports: [ConfigModule],
    }),
    HttpModule,
    ConfigModule,
    PassportModule,

    DiscordModule,
    UserModule,
  ],
  exports: [AuthService],
  providers: [AuthService, DiscordStrategy, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
