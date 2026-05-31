import { Global, Module } from '@nestjs/common';
import { REDIS } from './redis.port';
import RedisProvider from './redis.provider';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [RedisProvider, { provide: REDIS, useClass: RedisService }],
  exports: [REDIS],
})
export class RedisModule {}
