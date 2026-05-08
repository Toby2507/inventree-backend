import { Kysely } from 'kysely';
import { AnalyticsDB, OperationalDB } from './db.schema.types';

export interface CommandDbContext {
  operational: Kysely<OperationalDB>;
  analytics: Kysely<AnalyticsDB>;
}

export interface QueryDbContext {
  operational: Kysely<OperationalDB>;
  analytics: Kysely<AnalyticsDB>;
}
