import { DatabaseClient, DatabaseProviderPort } from '@app/database/ports/provider.port';
import { EventEmitter } from 'events';

type PgQueryable = DatabaseClient & {
  query: (sql: string) => Promise<unknown>;
  connect: () => Promise<DatabaseClient>;
};

export const makeDatabaseConnectionMock = () => ({});

export const makeDatabaseClientMock = () => {
  const emitter = new EventEmitter();
  const conn = Object.assign(emitter, {
    query: jest.fn().mockResolvedValue(undefined),
    connect: jest.fn().mockResolvedValue(undefined),
  });
  conn.on('error', () => {});
  return conn as unknown as jest.Mocked<PgQueryable>;
};

export const makeDatabaseProviderMock = () => {
  let client = makeDatabaseClientMock();
  const recreateClient = () => {
    client = makeDatabaseClientMock();
  };
  return {
    forBootstrapMigration: makeDatabaseConnectionMock(),
    forOperationalMigration: makeDatabaseConnectionMock(),
    forAnalyticsMigration: makeDatabaseConnectionMock(),
    analyticsRead: makeDatabaseConnectionMock(),
    analyticsWrite: makeDatabaseConnectionMock(),
    operationalRead: makeDatabaseConnectionMock(),
    operationalWrite: makeDatabaseConnectionMock(),
    createNotificationClient: jest.fn().mockResolvedValue(client),
    destroyNotificationClient: jest.fn().mockResolvedValue(undefined),
    client,
    recreateClient,
  } as unknown as jest.Mocked<
    DatabaseProviderPort & {
      client: jest.Mocked<PgQueryable>;
      recreateClient: () => void;
    }
  >;
};
