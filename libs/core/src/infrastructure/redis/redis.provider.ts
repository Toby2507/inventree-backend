import { CACHE_CONFIG, CacheConfig, cacheConfig } from '@app/config';
import { ConfigModule } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

export default {
  provide: REDIS_CLIENT,
  imports: [ConfigModule.forFeature(cacheConfig)],
  inject: [CACHE_CONFIG],
  useFactory: async (config: CacheConfig) => {
    return new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
    });
  },
};
