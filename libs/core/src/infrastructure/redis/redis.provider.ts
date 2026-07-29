import { CACHE_CONFIG, type CacheConfig } from '@app/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

export default {
  provide: REDIS_CLIENT,
  inject: [CACHE_CONFIG],
  useFactory: async (config: CacheConfig) => {
    return new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
    });
  },
};
