import { cacheConfig } from '@app/config';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { REDIS } from './redis.port';
import RedisProvider from './redis.provider';
import { RedisService } from './redis.service';

@Global()
@Module({
  imports: [ConfigModule.forFeature(cacheConfig)],
  providers: [RedisProvider, { provide: REDIS, useClass: RedisService }],
  exports: [REDIS],
})
export class RedisModule {}
