import { IdempotencyStrategyFactory } from '@app/core/reliability/idempotency/strategies/factory';

export const makeIdempotencyStrategyMock = () => ({
  handle: jest.fn(),
});

export const makeIdempotencyStrategyFactoryMock = () => {
  return {
    get: jest.fn(),
  } as unknown as jest.Mocked<IdempotencyStrategyFactory>;
};
