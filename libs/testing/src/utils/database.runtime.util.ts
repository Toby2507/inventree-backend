import { Kysely, PostgresDialect } from 'kysely';
import { Client, Pool } from 'pg';
import { getAdminConfig, getUserConfig } from './database.infrastructure.util';

export interface TestContext<T = any> {
  db: Kysely<T>;
  rollback(): Promise<void>;
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
