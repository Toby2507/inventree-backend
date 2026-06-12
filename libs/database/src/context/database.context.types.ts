import { DomainEvent } from '@app/common/bases';
import { AnalyticsDB, OperationalDB } from '../types/db.schema.types';

export interface CommandDbContext {
  operational: OperationalDB;
  analytics: AnalyticsDB;
  events: DomainEvent[];
}

export interface QueryDbContext {
  operational: OperationalDB;
  analytics: AnalyticsDB;
}

export interface DatabaseContextPort {
  command<T>(operation: (ctx: CommandDbContext) => Promise<T>): Promise<T>;
  query<T>(operation: (ctx: QueryDbContext) => Promise<T>): Promise<T>;
  platformCommand<T>(operation: (ctx: CommandDbContext) => Promise<T>): Promise<T>;
  platformQuery<T>(operation: (ctx: QueryDbContext) => Promise<T>): Promise<T>;
}

export const DATABASE_CONTEXT = Symbol('DATABASE_CONTEXT');
