import { IdempotencyRepository } from '@app/core/reliability/idempotency/persistence/idempotency.port';

export const makeIdempotencyRepositoryMock = () => {
  return {
    tryClaim: jest.fn(),
    findActiveRecord: jest.fn(),
    markCompleted: jest.fn(),
    markFailed: jest.fn(),
    deleteExpired: jest.fn(),
    deleteRecord: jest.fn(),
    sweepStaleInProgress: jest.fn(),
  } as unknown as jest.Mocked<IdempotencyRepository>;
};
