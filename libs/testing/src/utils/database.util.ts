import { migrations } from '@app/database/migrations';
import { Kysely, PostgresDialect, Migrator, sql } from 'kysely';
import { Client, Pool } from 'pg';

const SUPERUSER_CONFIG = {
  user: process.env.PG_SUPERUSER,
  host: process.env.PG_HOST || 'localhost',
  database: 'postgres',
  password: process.env.PG_PASSWORD,
  port: Number(process.env.PG_PORT) || 5432,
};
const EXTENSIONS = ['citext', 'pg_trgm', 'ltree', 'pg_stat_statements', 'postgis'];

export const recreateTestDB = async (name: string) => {
  const client = new Client(SUPERUSER_CONFIG);
  await client.connect();

  await client.query(`DROP DATABASE IF EXISTS ${name};`);
  await client.query(`CREATE DATABASE ${name};`);
  await client.query(`ALTER DATABASE ${name} OWNER TO ${process.env.DB_USER};`);
  await client.query(`GRANT ALL PRIVILEGES ON DATABASE ${name} TO ${process.env.DB_USER};`);

  await client.end();
};

export const installExtensions = async (dbName: string) => {
  const client = new Client({ ...SUPERUSER_CONFIG, database: dbName });
  await client.connect();
  for (const ext of EXTENSIONS) await client.query(`CREATE EXTENSION IF NOT EXISTS ${ext};`);
  await client.end();
};

export const dropTestDB = async (name: string) => {
  const client = new Client(SUPERUSER_CONFIG);
  await client.connect();
  await client.query(`DROP DATABASE IF EXISTS ${name};`);
  await client.end();
};

export const runMigrations = async (dbName: string): Promise<void> => {
  const db = new Kysely<any>({
    dialect: new PostgresDialect({
      pool: new Pool({
        host: process.env.PG_HOST ?? 'localhost',
        port: Number(process.env.PG_PORT ?? 5432),
        database: dbName,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      }),
    }),
  });

  try {
    const migrator = new Migrator({
      db,
      provider: { getMigrations: async () => migrations },
    });
    console.log(`[Global Setup] Running migrations for ${dbName}...`);
    const { error } = await migrator.migrateToLatest();
    if (error) {
      console.log('[Global Setup] Migration failed.', error);
      throw error;
    }
    console.log('[Global Setup] Migration complete.');
  } finally {
    await db.destroy();
  }
};

/**
 * Truncates all tables in the given schemas with CASCADE + RESTART IDENTITY.
 * Use in afterEach/afterAll hooks to keep integration tests isolated.
 *
 * TRUNCATE is not subject to RLS — no store context required.
 * Kysely migration tracking tables live in `public` and are unaffected.
 */
export const truncateTables = async (
  db: Kysely<any>,
  schemas: string[] = ['operational'],
): Promise<void> => {
  const { rows } = await sql<{ schemaname: string; tablename: string }>`
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = ANY(${schemas}::text[])
    ORDER BY schemaname, tablename
  `.execute(db);

  if (!rows.length) return;

  const tableRefs = rows.map((r) => `"${r.schemaname}"."${r.tablename}"`).join(', ');

  await sql.raw(`TRUNCATE TABLE ${tableRefs} RESTART IDENTITY CASCADE`).execute(db);
};
