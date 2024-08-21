import { Logger, Req, UseGuards } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Request } from 'express';

import { SocketEvents } from 'src/socket/events';
import { PlayerEvents } from 'src/discord/player/actions';
import { DiscordPlayerService } from 'src/discord/player/discord.player.service';
import { WsGuard } from 'src/auth/guards/ws.auth.guard';
import { AuthService } from 'src/auth/auth.service';
import { User } from '@prisma/client';
import { WebSocketEventPayload } from 'src/socket/types';
import { DiscordPlayerState } from 'src/discord/types';
import { DiscordMessageService } from 'src/discord/discord.message.service';
import { InvalidPlayerActionError } from 'src/discord/exceptions';
import { DiscordGuildService } from 'src/discord/discord.guild.service';
import { DiscordPlayerMessageService } from 'src/discord/player/discord.player.message.service';

const CHANGE_PLAYER_STATE_EVENT = 'CHANGE_PLAYER_STATE' as const;

@WebSocketGateway(parseInt(process.env.SOCKET_PORT), { cors: { origin: process.env.UI_URL } })
export class SocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(SocketGateway.name);

  @WebSocketServer() io: Server;

  constructor(
    private readonly discordPlayerService: DiscordPlayerService,
    private readonly authService: AuthService,
    private readonly discordMessageService: DiscordMessageService,
    private readonly discordGuildService: DiscordGuildService,
    private readonly discordPlayerMessageService: DiscordPlayerMessageService,
  ) {}

  public afterInit() {
    this.logger.log('Socket initialized');
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

  @UseGuards(WsGuard)
  @SubscribeMessage(CHANGE_PLAYER_STATE_EVENT)
  public async handleChangePlayerStateEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() { action }: { action: typeof CHANGE_PLAYER_STATE_EVENT },
    @Req() request: WsRequest,
  ): Promise<WebSocketEventPayload<typeof CHANGE_PLAYER_STATE_EVENT, DiscordPlayerState>> {
    this.logger.log(`Message received from client id: ${client.id}`);

    const userFromJwt = this.extractUserFromWsRequestUsingJwt(request);
    const guildId = await this.discordGuildService.getActiveGuildId({ userId: userFromJwt.id, interaction: undefined });

    try {
      const message = await this.discordPlayerService.changePlayerState({
        action,
        guildId,
      });

      const playerState = await this.discordPlayerService.getCurrentPlayerState(guildId);

      const sendMessagesRequests = [
        this.discordMessageService.replyAndDeleteAfterDelay({
          message,
          interaction: undefined,
          guildId,
        }),
        this.discordPlayerMessageService.sendCurrentTrackDetails({
          interaction: undefined,
          guildId,
          playerState,
        }),
      ];

      await Promise.all(sendMessagesRequests);
    } catch (error) {
      if (error instanceof InvalidPlayerActionError) {
        throw new WsException('Invalid Payload');
      }
      throw error;
    }

    return {
      event: CHANGE_PLAYER_STATE_EVENT,
      data: {
        action,
        payload: null,
      },
    };
  }

  @UseGuards(WsGuard)
  @SubscribeMessage(PlayerEvents.CURRENT_TRACK)
  public async handleCurrentTrackRequestEvent(
    @ConnectedSocket() client: Socket,
    @Req() request: WsRequest,
  ): Promise<WebSocketEventPayload<PlayerEvents, DiscordPlayerState>> {
    this.logger.log(`Message received from client id: ${client.id}`);

    const userFromJwt = this.extractUserFromWsRequestUsingJwt(request);
    const guildId = await this.discordGuildService.getActiveGuildId({ userId: userFromJwt.id, interaction: undefined });

    const payload = await this.discordPlayerService.getCurrentPlayerState(guildId);

    return {
      event: PlayerEvents.CURRENT_TRACK,
      data: {
        action: PlayerEvents.CURRENT_TRACK,
        payload,
      },
    };
  }

  // TODO there should be a way to attach User to the request. But for now it's the only way to do it
  private extractUserFromWsRequestUsingJwt(request: WsRequest): User {
    const token = request.handshake?.headers?.authorization?.split(' ')?.[1];

    // Token can't be undefined if use WsGuard
    if (!token) {
      throw new WsException(
        'JWT token not found in the request headers. Check if the authorization guard is used correctly.',
      );
    }

    return this.authService.decodeJwt<User>(token);
  }
}

interface WsRequest extends Request {
  handshake: {
    headers: {
      authorization?: string;
    };
  };
}
