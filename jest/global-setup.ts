import 'tsconfig-paths/register';
import { installExtensions, recreateTestDB } from '@app/testing';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

// Load environment variables from .env.test if it exists
const envFile = '.env.test';
if (fs.existsSync(envFile) && fs.existsSync('.env')) dotenv.config({ path: envFile });

// Configuration for test database setup
const TEST_DB = 'integration_db';

export default async () => {
  if (process.env.PG_SUPERUSER) {
    await recreateTestDB(TEST_DB);
    await installExtensions(TEST_DB);
  } else console.log('CI environment detected — skipping DB setup');
};
