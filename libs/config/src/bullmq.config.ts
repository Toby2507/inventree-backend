import { ConfigService } from '@nestjs/config';

export const bullmqConfig = {
  provide: 'BULL_MQ',
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    connection: {
      host: configService.get<string>('REDIS_HOST', 'redis_cache'),
      port: configService.get<number>('REDIS_PORT', 6379),
      password: configService.get<string>('REDIS_PASSWORD'),
    },
  }),
};
