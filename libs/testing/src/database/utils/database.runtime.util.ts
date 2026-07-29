import { ControlledTransaction, Kysely, PostgresDialect, sql } from 'kysely';
import { Client, Pool } from 'pg';
import { getAdminConfig, getUserConfig } from './database.infrastructure.util';

export interface TestContext<T = any> {
  begin(): Promise<Kysely<T>>;
  dispose(): Promise<void>;
  rollback(): Promise<void>;
  run(op: (db: Kysely<any>) => Promise<void>): Promise<void>;
}

export const getTestDbName = () => {
  const workerId = process.env.JEST_WORKER_ID || '1';
  return `test_worker_db_${Number(workerId)}`;
};

export const cloneDatabase = async (sourceDb: string, targetDb: string) => {
  const config = getAdminConfig();
  const client = new Client(config);
  await client.connect();
  try {
    await client.query(`CREATE DATABASE ${targetDb} TEMPLATE ${sourceDb};`);
    await client.query(`ALTER DATABASE ${targetDb} OWNER TO ${process.env.DB_USER};`);
    await client.query(`GRANT ALL PRIVILEGES ON DATABASE ${targetDb} TO ${process.env.DB_USER};`);
  } catch (error: any) {
    if (error.code !== '42P04') throw error;
  } finally {
    await client.end();
  }
};

export const createTestDb = <T = any>(): Kysely<T> => {
  const config = getUserConfig();
  const dbName = getTestDbName();
  return new Kysely<T>({
    dialect: new PostgresDialect({
      pool: new Pool({ ...config, database: dbName, max: 10 }),
    }),
  });
};

/**
 * Creates a reusable integration test context with:
 * - one shared DB instance per test file
 * - one rollbackable transaction per test
 *
 * @example ```
 * beforeAll(async () => {
 *   ctx = await createTestContext();
 *   await ctx.run(async (db) => {...}); // run migrations or seed data
 * });
 * beforeEach(async () => {
 *   db = await ctx.begin();
 * });
 * afterEach(async () => {
 *   await ctx.rollback();
 * });
 * afterAll(async () => {
 *   await ctx.dispose();
 * });
 * ```
 */
export const createTestContext = async (schema: string = 'operational'): Promise<TestContext> => {
  const dbInstance = createTestDb();
  let trx: ControlledTransaction<any, []> | null = null;

  const migrationTable = `kysely_migration_${schema}`;
  const excludedTables = new Set([migrationTable, `${migrationTable}_lock`]);
  const tables = (
    await dbInstance
      .selectFrom('pg_tables')
      .select('tablename')
      .where('schemaname', '=', schema)
      .execute()
  )
    .map((r) => r.tablename as string)
    .filter((t) => !excludedTables.has(t));

  const run = async (op: (db: Kysely<any>) => Promise<void>): Promise<void> => {
    const trx = await dbInstance.startTransaction().execute();
    try {
      await op(trx.withSchema(schema));
      await trx.commit().execute();
    } catch (error) {
      await trx.rollback().execute();
      throw error;
    }
  };
  const rollback = async () => {
    if (!trx) return;
    await trx.rollback().execute();
    trx = null;
  };
  const begin = async () => {
    await rollback();
    trx = await dbInstance.startTransaction().execute();
    return trx.withSchema(schema);
  };
  const reset = async () => {
    await rollback();
    if (!tables.length) return;
    await sql`
      TRUNCATE TABLE ${sql.join(
        tables.map((t) => sql.id(schema, t)),
        sql`, `,
      )}
      RESTART IDENTITY CASCADE
    `.execute(dbInstance);
  };
  const dispose = async () => {
    await reset();
    await dbInstance.destroy();
  };

  return { begin, dispose, rollback, run };
};
