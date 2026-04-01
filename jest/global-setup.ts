import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

// Load environment variables from .env.test if it exists
const envFile = '.env.test';
if (fs.existsSync(envFile)) dotenv.config({ path: envFile });

// Configuration for test database setup/teardown
const TEST_DB = 'integration_db';
const SUPERUSER_CONFIG = {
  user: process.env.PG_SUPERUSER, // use CI env variable or default
  host: process.env.PG_HOST || 'localhost',
  database: 'postgres', // connect to default DB to drop/create
  password: process.env.PG_PASSWORD,
  port: Number(process.env.PG_PORT) || 5432,
};
const EXTENSIONS = ['citext', 'pg_trgm', 'ltree', 'pg_stat_statements', 'postgis'];

const recreateTestDB = async () => {
  const client = new Client(SUPERUSER_CONFIG);
  await client.connect();
  // Drop and recreate the DB
  await client.query(`DROP DATABASE IF EXISTS ${TEST_DB};`);
  await client.query(`CREATE DATABASE ${TEST_DB};`);
  // Grant all privileges to the test user
  await client.query(`ALTER DATABASE ${TEST_DB} OWNER TO ${process.env.DB_USER};`);
  await client.query(`GRANT ALL PRIVILEGES ON DATABASE ${TEST_DB} TO ${process.env.DB_USER};`);
  // Close the connection
  await client.end();
};

const installExtensions = async () => {
  const client = new Client({ ...SUPERUSER_CONFIG, database: TEST_DB });
  await client.connect();

  for (const ext of EXTENSIONS) {
    await client.query(`CREATE EXTENSION IF NOT EXISTS ${ext};`);
  }

  await client.end();
};

export default async () => {
  if (process.env.PG_SUPERUSER) {
    await recreateTestDB();
    await installExtensions();
  } else console.log('CI environment detected — skipping DB setup');
};
