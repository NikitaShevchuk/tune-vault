import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthModule } from './auth.module';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from 'src/user/user.module';
import { DbModule } from 'src/db/db.module';
import { validate } from 'class-validator';
import configuration from 'src/config/configuration';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        AuthModule,
        ConfigModule.forRoot({ load: [configuration], validate, envFilePath: '.env.test' }),
        UserModule,
        DbModule,
      ],
      controllers: [AuthController],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
