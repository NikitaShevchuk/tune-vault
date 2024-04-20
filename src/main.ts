import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DiscordService } from './discord/discord.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const discordService = app.get<DiscordService>(DiscordService);
  discordService.initialize();
  await app.listen(3000);
}
bootstrap();
