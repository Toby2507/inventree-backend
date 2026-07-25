import type { Client } from 'pg';
import type { AnalyticsDB, OperationalDB } from '../types/db.schema.types';

export type DatabaseClient = Client;

export interface DatabaseProvider {
  createNotificationClient(): Promise<DatabaseClient>;
  destroyNotificationClient(client: DatabaseClient): Promise<void>;
  forBootstrapMigration: OperationalDB;
  forOperationalMigration: OperationalDB;
  forAnalyticsMigration: AnalyticsDB;
  analyticsRead: AnalyticsDB;
  analyticsWrite: AnalyticsDB;
  operationalRead: OperationalDB;
  operationalWrite: OperationalDB;
}

export const DATABASE_PROVIDER = Symbol('DATABASE_PROVIDER');
