import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DiscordModule } from './discord/discord.module';

@Module({
  imports: [ConfigModule.forRoot(), DiscordModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
