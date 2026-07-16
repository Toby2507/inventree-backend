import type { Client } from 'pg';
import type { AnalyticsDB, OperationalDB } from '../types/db.schema.types';

export type NotificationConnection = Client;

export interface DatabaseProviderPort {
  createNotificationClient(): Promise<NotificationConnection>;
  destroyNotificationClient(client: NotificationConnection): Promise<void>;
  forBootstrapMigration: OperationalDB;
  forOperationalMigration: OperationalDB;
  forAnalyticsMigration: AnalyticsDB;
  analyticsRead: AnalyticsDB;
  analyticsWrite: AnalyticsDB;
  operationalRead: OperationalDB;
  operationalWrite: OperationalDB;
}

export const DATABASE_PROVIDER = Symbol('DATABASE_PROVIDER');
