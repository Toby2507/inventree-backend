import 'tsconfig-paths/register';
import { installExtensions, recreateTestDB, runMigrations } from '@app/testing';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

const envFile = '.env.test';
// .env.test is only used for local development — CI sets env vars directly. We want to avoid accidentally loading .env.test in CI, but also want to allow it to override .env in local dev if present.
if (fs.existsSync(envFile) && fs.existsSync('.env')) dotenv.config({ path: envFile });

// Configuration for test database setup
const TEST_DB = 'integration_db';

export default async () => {
  if (!process.env.PG_SUPERUSER) {
    console.log('[Global Setup] CI environment detected — skipping DB setup');
    return;
  }

  console.log('[Global Setup] Setting up test database...');
  await recreateTestDB(TEST_DB);
  await installExtensions(TEST_DB);
  await runMigrations(TEST_DB);
  console.log('[Global Setup] Test database setup complete');
};
