import { Injectable } from '@nestjs/common';
import type { IdempotencyStrategyType } from '../decorators/idempotency.decorator';
import type { DurableIdempotencyStrategy } from './durable.strategy';
import type { IdempotencyStrategy } from './interface';
import type { RedisIdempotencyStrategy } from './redis.strategy';

@Injectable()
export class IdempotencyStrategyFactory {
  constructor(
    private readonly redisStrategy: RedisIdempotencyStrategy,
    private readonly durableStrategy: DurableIdempotencyStrategy,
  ) {}

  get(type: IdempotencyStrategyType): IdempotencyStrategy {
    if (type === 'redis') return this.redisStrategy;
    if (type === 'durable') return this.durableStrategy;
    throw new Error('Invalid idempotency strategy');
  }
}
