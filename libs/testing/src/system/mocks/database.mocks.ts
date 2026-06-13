import { DatabaseContextPort } from '@app/database';

type ContextMock = jest.Mocked<
  DatabaseContextPort & { operational: any; analytics: any; events: { emit: jest.Mock } }
>;

export const makeDatabaseContextMock = (): ContextMock => {
  const operational = {};
  const analytics = {};
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
