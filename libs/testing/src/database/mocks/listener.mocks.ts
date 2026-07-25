import type { DatabaseListener } from '@app/database';

export const makeDatabaseListenerMock = () => {
  return {
    start: jest.fn(),
    stop: jest.fn(),
    isHealthy: true,
    subscribe: jest.fn().mockReturnValue(() => {}),
  } as unknown as jest.Mocked<DatabaseListener>;
};
