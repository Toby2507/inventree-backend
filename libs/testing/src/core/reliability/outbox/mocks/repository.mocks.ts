import { OutboxRepository } from '@app/core/reliability/outbox/ports/repository.port';

export const makeOutboxRepositoryMock = () => {
  return {
    insert: jest.fn(),
    claimBatch: jest.fn(),
    markPublished: jest.fn(),
    markFailed: jest.fn(),
    releaseExpiredLocks: jest.fn(),
  } as unknown as jest.Mocked<OutboxRepository>;
};
