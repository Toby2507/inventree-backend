import { DatabaseContextPort } from '@app/database';
import { makeDatabaseConnectionMock } from './provider.mocks';

type ContextMock = jest.Mocked<
  DatabaseContextPort & { operational: any; analytics: any; events: { emit: jest.Mock } }
>;

export const makeDatabaseContextMock = (): ContextMock => {
  const operational = makeDatabaseConnectionMock();
  const analytics = makeDatabaseConnectionMock();
  const events = { emit: jest.fn() };
  const runCmdOps = jest.fn(async (cb) => cb({ operational, analytics, events }));
  const runQueryOps = jest.fn(async (cb) => cb({ operational, analytics }));
  return {
    command: runCmdOps,
    platformCommand: runCmdOps,
    query: runQueryOps,
    platformQuery: runQueryOps,
    operational,
    analytics,
    events,
  };
};
