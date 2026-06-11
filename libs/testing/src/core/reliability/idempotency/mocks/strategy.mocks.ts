import { IdempotencyStrategyFactory } from '@app/core/reliability/idempotency/strategies/factory';
import { RedisIdempotencyStrategy } from '@app/core/reliability/idempotency/strategies/redis.strategy';

export const makeIdempotencyStrategyMock = <T = RedisIdempotencyStrategy>() => {
  return {
    handle: jest.fn(),
  } as unknown as jest.Mocked<T>;
};

export const makeIdempotencyStrategyFactoryMock = () => {
  return {
    get: jest.fn(),
  } as unknown as jest.Mocked<IdempotencyStrategyFactory>;
};
