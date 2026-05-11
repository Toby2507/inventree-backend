import 'tsconfig-paths/register';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { installExtensions, recreateTestDB } from '@app/testing';

const envFile = '.env.test';
// .env.test is only used for local development — CI sets env vars directly. We want to avoid accidentally loading .env.test in CI, but also want to allow it to override .env in local dev if present.
if (fs.existsSync(envFile) && fs.existsSync('.env')) dotenv.config({ path: envFile });
console.log('[Migration Global Setup] Using environment variables:', process.env);

const MIGRATION_TEST_DB = 'integration_migration_db';

export default async (): Promise<void> => {
  console.log('[Migration Global Setup] Setting up migration test database...');
  await recreateTestDB(MIGRATION_TEST_DB);
  await installExtensions(MIGRATION_TEST_DB);
  // No migrations — migration tests own the full schema lifecycle
  console.log('[Migration Global Setup] Migration test database setup complete');
};
