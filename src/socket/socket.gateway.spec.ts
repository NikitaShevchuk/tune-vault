import { Test } from '@nestjs/testing';
import { SocketGateway } from './socket.gateway';
import { INestApplication } from '@nestjs/common';
import { Socket, io } from 'socket.io-client';
import { SocketEvents } from './events';

async function createNestApp(...gateways: any): Promise<INestApplication> {
  const testingModule = await Test.createTestingModule({
    providers: gateways,
  }).compile();
  return testingModule.createNestApplication();
}

describe('SocketGateway', () => {
  let gateway: SocketGateway;
  let app: INestApplication;
  let ioClient: Socket;

  beforeAll(async () => {
    // Instantiate the app
    app = await createNestApp(SocketGateway);
    // Get the gateway instance from the app instance
    gateway = app.get<SocketGateway>(SocketGateway);
    // Create a new client that will interact with the gateway
    ioClient = io('http://localhost:3000', {
      autoConnect: false,
      transports: ['websocket', 'polling'],
    });

    app.listen(3000);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('should emit "pong" on "ping"', async () => {
    ioClient.connect();
    ioClient.emit(SocketEvents.PING);
    await new Promise<void>((resolve) => {
      ioClient.on('connect', () => {
        console.log('connected');
      });
      ioClient.on(SocketEvents.PONG, (data) => {
        expect(data).toBe('Hello world!');
        resolve();
      });
    });
    ioClient.disconnect();
  });
});
