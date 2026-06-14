import { OutboxRepository } from '@app/core/reliability/outbox/persistence/outbox.repository.port';

export const makeOutboxRepositoryMock = () => {
  return {
    insert: jest.fn(),
  } as unknown as jest.Mocked<OutboxRepository>;
};
