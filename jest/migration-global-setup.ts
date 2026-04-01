import 'tsconfig-paths/register';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { installExtensions, recreateTestDB } from '@app/testing';

const envFile = '.env.test';
// .env.test is only used for local development — CI sets env vars directly. We want to avoid accidentally loading .env.test in CI, but also want to allow it to override .env in local dev if present.
if (fs.existsSync(envFile) && fs.existsSync('.env')) dotenv.config({ path: envFile });

const MIGRATION_TEST_DB = 'integration_migration_db';

export default async (): Promise<void> => {
  if (!process.env.PG_SUPERUSER) {
    console.log('[Global Setup] CI environment detected — skipping migration DB setup');
    return;
  }

  console.log('[Global Setup] Setting up migration test database...');
  await recreateTestDB(MIGRATION_TEST_DB);
  await installExtensions(MIGRATION_TEST_DB);
  // No migrations — migration tests own the full schema lifecycle
  console.log('[Global Setup] Migration test database setup complete');
};
