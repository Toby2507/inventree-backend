import type { Client } from 'pg';
import type { AnalyticsDB, OperationalDB } from '../types/db.schema.types';

export interface DatabaseProviderPort {
  forBootstrapMigration: OperationalDB;
  forOperationalMigration: OperationalDB;
  forAnalyticsMigration: AnalyticsDB;
  analyticsRead: AnalyticsDB;
  analyticsWrite: AnalyticsDB;
  operationalRead: OperationalDB;
  operationalWrite: OperationalDB;
  notificationClient: Client;
}

export const DATABASE_PROVIDER = Symbol('DATABASE_PROVIDER');
