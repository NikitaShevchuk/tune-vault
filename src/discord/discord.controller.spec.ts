import { Test, TestingModule } from '@nestjs/testing';
import { DiscordController } from './discord.controller';

import { CacheModule } from '@nestjs/cache-manager';
import { redisOptions } from 'src/db/redis-options';
import { DbModule } from 'src/db/db.module';
import { DiscordModule } from './discord.module';
import { UserModule } from 'src/user/user.module';

describe('DiscordController', () => {
  let controller: DiscordController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [UserModule, DbModule, CacheModule.registerAsync(redisOptions), DiscordModule],
      controllers: [DiscordController],
    }).compile();

    controller = module.get<DiscordController>(DiscordController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
