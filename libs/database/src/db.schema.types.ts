import { Kysely } from 'kysely';
import { DB } from './db.types';

export type OperationalSchema = {
  [K in keyof DB as K extends `operational.${infer T}` ? T : never]: DB[K];
};
export type AnalyticsSchema = {
  [K in keyof DB as K extends `analytics.${infer T}` ? T : never]: DB[K];
};

export type OperationalDB = Kysely<OperationalSchema>;
export type AnalyticsDB = Kysely<AnalyticsSchema>;
