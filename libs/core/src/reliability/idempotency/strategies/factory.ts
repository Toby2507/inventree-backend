import { Injectable } from '@nestjs/common';
import { IdempotencyStrategyType } from '../decorators/idempotency.decorator';
import { DurableIdempotencyStrategy } from './durable.strategy';
import { IdempotencyStrategy } from './interface';
import { RedisIdempotencyStrategy } from './redis.strategy';

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
