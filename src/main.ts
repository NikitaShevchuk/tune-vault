import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DiscordService } from './discord/discord.service';
import { PrismaClientExceptionFilter } from 'src/db/prisma-client-exception.filter';
import { ConfigService } from '@nestjs/config';
import { Configuration } from 'src/config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const discordService = app.get<DiscordService>(DiscordService);
  discordService.initialize();

  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new PrismaClientExceptionFilter(httpAdapter));

  const configService = app.get<ConfigService<Configuration, true>>(ConfigService);
  const origin = configService.get('uiUrl', { infer: true });
  app.enableCors({ origin });

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
