import { Module } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';
import { DiscordModule } from 'src/discord/discord.module';

@Module({ providers: [SocketGateway], imports: [DiscordModule] })
export class SocketModule {}
