import { DB } from './db.types';

export type OperationalDB = {
  [K in keyof DB as K extends `operational.${string}` ? K : never]: DB[K];
};

export type AnalyticsDB = {
  [K in keyof DB as K extends `analytics.${string}` ? K : never]: DB[K];
};
