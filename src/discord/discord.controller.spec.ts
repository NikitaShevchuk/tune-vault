import { Test, TestingModule } from '@nestjs/testing';
import { DiscordController } from './discord.controller';

import { DbModule } from 'src/db/db.module';
import { DiscordModule } from './discord.module';
import { UserModule } from 'src/user/user.module';

describe('DiscordController', () => {
  let controller: DiscordController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [UserModule, DbModule, DiscordModule],
      controllers: [DiscordController],
    }).compile();

    controller = module.get<DiscordController>(DiscordController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
