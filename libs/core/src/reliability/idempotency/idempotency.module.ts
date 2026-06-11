import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { IdempotencyInterceptor } from './interceptors/idempotency.interceptor';
import { IdempotencyKyselyRepository } from './persistence/idempotency.kysely.repository';
import { IDEMPOTENCY_REPOSITORY } from './persistence/idempotency.port';
import { IdempotencyService } from './services/idempotency.service';
import { DurableIdempotencyStrategy } from './strategies/durable.strategy';
import { IdempotencyStrategyFactory } from './strategies/factory';
import { RedisIdempotencyStrategy } from './strategies/redis.strategy';

@Global()
@Module({
  providers: [
    RedisIdempotencyStrategy,
    DurableIdempotencyStrategy,
    IdempotencyStrategyFactory,
    IdempotencyService,
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: IDEMPOTENCY_REPOSITORY, useClass: IdempotencyKyselyRepository },
  ],
})
export class IdempotencyModule {}
