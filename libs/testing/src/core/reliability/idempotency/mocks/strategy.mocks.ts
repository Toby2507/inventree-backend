import { IdempotencyStrategyFactory } from '@app/core/reliability/idempotency/strategies/factory';

export const makeIdempotencyRedisStrategyMock = () => ({
  handle: jest.fn(),
});

export const makeIdempotencyDurableStrategyMock = () => ({
  handle: jest.fn(),
});

export const makeIdempotencyStrategyFactoryMock = () => {
  return {
    get: jest.fn(),
  } as unknown as jest.Mocked<IdempotencyStrategyFactory>;
};
