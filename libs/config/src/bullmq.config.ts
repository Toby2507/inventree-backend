import { ConfigModule } from '@nestjs/config';
import { CACHE_CONFIG, cacheConfig, CacheConfig } from './environments';

export const bullmqConfig = {
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
