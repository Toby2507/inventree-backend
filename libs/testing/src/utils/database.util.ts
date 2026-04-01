import { Client } from 'pg';

const SUPERUSER_CONFIG = {
  user: process.env.PG_SUPERUSER, // use CI env variable or default
  host: process.env.PG_HOST || 'localhost',
  database: 'postgres', // connect to default DB to drop/create
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
