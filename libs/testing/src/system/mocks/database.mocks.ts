import { DatabaseContextPort } from '@app/database';

type ContextMock = jest.Mocked<DatabaseContextPort & { operational: any; analytics: any }>;

export const makeDatabaseContextMock = (): ContextMock => {
  const operational = {};
  const analytics = {};
  const runOperation = jest.fn(async (cb) => cb({ operational, analytics }));
  return {
    command: runOperation,
    platformCommand: runOperation,
    query: runOperation,
    platformQuery: runOperation,
    operational,
    analytics,
  };
};
