import { CacheModuleAsyncOptions, CacheModuleOptions } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-store';

const TTL = 60 * 60 * 1000 * 3; // 3 hours

export const redisOptions: CacheModuleOptions<CacheModuleAsyncOptions<Record<string, any>>> = {
  isGlobal: true,
  imports: [ConfigModule],
  useFactory: async (configService: ConfigService) => {
    const store = await redisStore({
      socket: {
        host: configService.get<string>('REDIS_HOST'),
        port: parseInt(configService.get<string>('REDIS_PORT')!),
      },
    });
    return {
      store: () => store,
      ttl: TTL,
    };
  },
  inject: [ConfigService],
};
