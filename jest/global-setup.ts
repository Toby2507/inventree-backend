import 'tsconfig-paths/register';
import { installExtensions, recreateTestDB, runMigrations, TEMPLATE_DB_NAME } from '@app/testing';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

const envFile = '.env.test';
// .env.test is only used for local development — CI sets env vars directly. We want to avoid accidentally loading .env.test in CI, but also want to allow it to override .env in local dev if present.
if (fs.existsSync(envFile) && fs.existsSync('.env')) dotenv.config({ path: envFile });

export default async () => {
  console.log('[Global Setup] Setting up test database template...');
  await recreateTestDB(TEMPLATE_DB_NAME);
  await installExtensions(TEMPLATE_DB_NAME);
  await runMigrations(TEMPLATE_DB_NAME);
  console.log('[Global Setup] Test database template setup complete');
};
