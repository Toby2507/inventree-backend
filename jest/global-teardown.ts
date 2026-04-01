import 'tsconfig-paths/register';
import { dropTestDB } from '@app/testing';

const TEST_DB = 'integration_db';

export default async () => {
  if (process.env.PG_SUPERUSER) {
    console.log('[Global Teardown] Dropping test database...');
    await dropTestDB(TEST_DB);
    console.log('[Global Teardown] Test database dropped');
  } else console.log('[Global Teardown] CI environment detected — skipping DB teardown');
};
