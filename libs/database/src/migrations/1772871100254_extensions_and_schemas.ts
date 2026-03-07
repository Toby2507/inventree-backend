import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
    -- Extensions
    CREATE EXTENSION IF NOT EXISTS citext;
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
    CREATE EXTENSION IF NOT EXISTS pg_trgm;

    -- Schemas
    CREATE SCHEMA IF NOT EXISTS operational;
    CREATE SCHEMA IF NOT EXISTS analytics;

    -- Reusable updated_at trigger function
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `,
    )
    .execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
    DROP SCHEMA IF EXISTS analytics CASCADE;
    DROP SCHEMA IF EXISTS operational CASCADE;
  `,
    )
    .execute(db);
}
