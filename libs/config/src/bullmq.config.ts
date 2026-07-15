import { CACHE_CONFIG, CacheConfig } from './environments';

export const BULL_MQ = Symbol('BULL_MQ');

export const bullmqConfig = {
  provide: BULL_MQ,
  inject: [CACHE_CONFIG],
  useFactory: (config: CacheConfig) => ({
    connection: {
      host: config.host,
      port: config.port,
      password: config.password,
    },
  }),
};
