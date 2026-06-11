import 'tsconfig-paths/register';
import { installExtensions, MIGRATION_TEST_DB_NAME, recreateTestDB } from '@app/testing/database';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

const envFile = '.env.test';
// .env.test is only used for local development — CI sets env vars directly. We want to avoid accidentally loading .env.test in CI, but also want to allow it to override .env in local dev if present.
if (fs.existsSync(envFile) && fs.existsSync('.env')) dotenv.config({ path: envFile });

export default async (): Promise<void> => {
  console.log('[Migration Global Setup] Setting up migration test database...');
  await recreateTestDB(MIGRATION_TEST_DB_NAME);
  await installExtensions(MIGRATION_TEST_DB_NAME);
  // No migrations — migration tests own the full schema lifecycle
  console.log('[Migration Global Setup] Migration test database setup complete');
};
