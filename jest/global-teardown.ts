import 'tsconfig-paths/register';
import { dropTestDB } from '@app/testing';

const TEST_DB = 'integration_db';

export default async () => {
  if (process.env.PG_SUPERUSER) {
    await dropTestDB(TEST_DB);
  } else console.log('CI environment detected — skipping DB teardown');
};
