import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

import { AppModule } from 'src/app.module';
import { DiscordService } from 'src/discord/discord.service';
import { PrismaClientExceptionFilter } from 'src/db/prisma-client-exception.filter';
import { Configuration } from 'src/config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Discord module
  const discordService = app.get<DiscordService>(DiscordService);
  discordService.initialize();

  // Prisma exceptions filter
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new PrismaClientExceptionFilter(httpAdapter));

  // Cors
  const configService = app.get<ConfigService<Configuration, true>>(ConfigService);
  const frontendUrl = configService.get('uiUrl', { infer: true });
  // const extensionId = configService.get('extension.id', { infer: true });
  const chromeExtension = `chrome-extension://.*`;
  const origin = [frontendUrl, chromeExtension];
  app.enableCors({ origin });

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
