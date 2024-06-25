import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DiscordService } from './discord/discord.service';
import { PrismaClientExceptionFilter } from 'src/db/prisma-client-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const discordService = app.get<DiscordService>(DiscordService);
  discordService.initialize();

  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new PrismaClientExceptionFilter(httpAdapter));
  app.enableCors({ origin: process.env.UI_URL });

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
