import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Socket } from 'socket.io-client';

import { SocketEvents } from 'src/socket/events';
import { PlayerEvents } from 'src/discord/player/actions';
import { DiscordPlayerService } from 'src/discord/player/discord.player.service';

@WebSocketGateway(parseInt(process.env.SOCKET_PORT), { cors: { origin: process.env.UI_URL } })
export class SocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(SocketGateway.name);

  @WebSocketServer() io: Server;

  constructor(private readonly discordPlayerService: DiscordPlayerService) {}

  public afterInit() {
    this.logger.log('Initialized');
  }

  public handleConnection(client: Socket) {
    const { sockets } = this.io.sockets;

    this.logger.log(`Client id: ${client.id} connected`);
    this.logger.debug(`Number of connected clients: ${sockets.size}`);
  }

  public handleDisconnect(client: Socket) {
    this.logger.log(`Cliend id: ${client.id} disconnected`);
  }

  @SubscribeMessage(SocketEvents.PING)
  public handlePing(client: Socket, data: any) {
    this.logger.log(`Message received from client id: ${client.id}`);
    this.logger.debug(`Payload: ${data}`);
    return {
      event: SocketEvents.PONG,
      data: 'Hello world!',
    };
  }

  @SubscribeMessage(PlayerEvents.PAUSE_OR_PLAY)
  public async handlePauseOrPlay(client: Socket, data: any) {
    this.logger.log(`Message received from client id: ${client.id}`);
    this.logger.debug(`Payload: ${data}`);

    await this.discordPlayerService.changePlayerState({
      action: PlayerEvents.PAUSE_OR_PLAY,
      userId: client.id,
      interaction: undefined,
    });

    return {
      event: SocketEvents.SUCCESS,
    };
  }
}
