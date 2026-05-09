import { AnalyticsDB, OperationalDB } from './db.schema.types';

export interface CommandDbContext {
  operational: OperationalDB;
  analytics: AnalyticsDB;
}

export interface QueryDbContext {
  operational: OperationalDB;
  analytics: AnalyticsDB;
}
