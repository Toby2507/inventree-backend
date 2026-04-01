import { Client } from 'pg';

const TEST_DB = 'integration_db';
const SUPERUSER_CONFIG = {
  user: process.env.PG_SUPERUSER, // use CI env variable or default
  host: process.env.PG_HOST || 'localhost',
  database: 'postgres', // connect to default DB to drop/create
  password: process.env.PG_PASSWORD,
  port: Number(process.env.PG_PORT) || 5432,
};

const dropTestDB = async () => {
  const client = new Client(SUPERUSER_CONFIG);
  await client.connect();
  await client.query(`DROP DATABASE IF EXISTS ${TEST_DB};`);
  await client.end();
};

export default async () => {
  if (process.env.PG_SUPERUSER) {
    await dropTestDB();
  } else console.log('CI environment detected — skipping DB teardown');
};
