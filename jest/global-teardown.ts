import 'tsconfig-paths/register';
import { dropDatabasesByPrefix } from '@app/testing';

const TEST_DBS_PREFIX = 'integration_';

export default async () => {
  if (process.env.PG_SUPERUSER) {
    console.log('[Global Teardown] Dropping test databases...');
    await dropDatabasesByPrefix(TEST_DBS_PREFIX);
    console.log('[Global Teardown] Test databases dropped');
  } else console.log('[Global Teardown] CI environment detected — skipping DB teardown');
};
