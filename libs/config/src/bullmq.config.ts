import { ConfigModule } from '@nestjs/config';
import { CACHE_CONFIG, CacheConfig, cacheConfig } from './environments';

export const bullmqConfig = {
  provide: 'BULL_MQ',
  imports: [ConfigModule.forFeature(cacheConfig)],
  inject: [CACHE_CONFIG],
  useFactory: (config: CacheConfig) => ({
    connection: {
      host: config.host,
      port: config.port,
      password: config.password,
    },
  }),
};
