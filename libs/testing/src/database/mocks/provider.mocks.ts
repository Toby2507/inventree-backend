import { DatabaseProviderPort } from '@app/database';

export const makeDatabaseConnectionMock = () => ({});

export const makeDatabaseProviderMock = () => {
  return {
    forBootstrapMigration: makeDatabaseConnectionMock(),
    forOperationalMigration: makeDatabaseConnectionMock(),
    forAnalyticsMigration: makeDatabaseConnectionMock(),
    analyticsRead: makeDatabaseConnectionMock(),
    analyticsWrite: makeDatabaseConnectionMock(),
    operationalRead: makeDatabaseConnectionMock(),
    operationalWrite: makeDatabaseConnectionMock(),
    notificationClient: {
      on: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue(undefined),
      connect: jest.fn().mockResolvedValue(undefined),
    },
  } as unknown as jest.Mocked<DatabaseProviderPort>;
};
