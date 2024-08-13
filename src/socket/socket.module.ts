import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { SocketGateway } from './socket.gateway';
import { DiscordModule } from 'src/discord/discord.module';
import { UserModule } from 'src/user/user.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  providers: [SocketGateway],
  imports: [DiscordModule, UserModule, ConfigModule, AuthModule],
})
export class SocketModule {}
