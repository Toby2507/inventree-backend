import {
  analyticsMigrations,
  bootstrapMigrations,
  operationalMigrations,
} from '@app/database/migrations';
import { Kysely, Migrator, PostgresDialect } from 'kysely';
import { Client, Pool } from 'pg';

const SUPERUSER_CONFIG = {
  user: process.env.PG_SUPERUSER,
  host: process.env.PG_HOST || 'localhost',
  database: 'postgres',
  password: process.env.PG_PASSWORD,
  port: Number(process.env.PG_PORT) || 5432,
};
const EXTENSIONS = ['citext', 'pg_trgm', 'ltree', 'pg_stat_statements', 'postgis'];

export const DB_TEMPLATE_NAME = 'integration_template';

export const getTestDbName = () => {
  const workerId = process.env.JEST_WORKER_ID || '1';
  return `integration_worker_${Number(workerId)}`;
};

// Setup functions
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
      provider: {
        getMigrations: async () => ({
          ...bootstrapMigrations,
          ...operationalMigrations,
          ...analyticsMigrations,
        }),
      },
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

// Helper Functions
export const cloneDatabase = async (sourceDb: string, targetDb: string) => {
  const client = new Client(SUPERUSER_CONFIG);
  await client.connect();
  try {
    await client.query(`CREATE DATABASE ${targetDb} TEMPLATE ${sourceDb};`);
  } catch (error: any) {
    if (error.code !== '42P04') throw error;
  } finally {
    await client.end();
  }
};

export const createTestDb = <T = any>(): Kysely<T> => {
  const dbName = getTestDbName();
  return new Kysely<T>({
    dialect: new PostgresDialect({
      pool: new Pool({
        host: process.env.PG_HOST ?? 'localhost',
        port: Number(process.env.PG_PORT ?? 5432),
        database: dbName,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        max: 10,
      }),
    }),
  });
};

export const dropTestDB = async (name: string) => {
  const client = new Client(SUPERUSER_CONFIG);
  await client.connect();
  // Kill active connections
  await client.query(
    `
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = $1
      AND pid <> pg_backend_pid()
    `,
    [name],
  );
  // Drop DB
  await client.query(`DROP DATABASE IF EXISTS ${name};`);
  await client.end();
};

export const dropDatabasesByPrefix = async (prefix: string): Promise<void> => {
  const client = new Client(SUPERUSER_CONFIG);
  await client.connect();
  try {
    // Find matching databases
    const { rows } = await client.query<{ datname: string }>(
      `SELECT datname FROM pg_database WHERE datname LIKE $1`,
      [`${prefix}%`],
    );
    for (const row of rows) {
      const dbName = row.datname;
      // Prevent accidental dangerous drops
      if (!dbName.startsWith(prefix)) continue;
      console.log(`[Global Teardown] Dropping ${dbName}`);
      await dropTestDB(dbName);
    }
  } finally {
    await client.end();
  }
};

export interface TestContext<T = any> {
  db: Kysely<T>;
  rollback(): Promise<void>;
}

export const createTestContext = async (schema: string = 'operational'): Promise<TestContext> => {
  const db = createTestDb();
  const trx = await db.startTransaction().execute();

  return {
    db: trx.withSchema(schema),
    async rollback() {
      await trx.rollback().execute();
      await db.destroy();
    },
  };
};
