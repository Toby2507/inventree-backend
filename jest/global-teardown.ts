import 'tsconfig-paths/register';
import { dropDatabasesByPrefix } from '@app/testing';

const TEST_DBS_PREFIX = 'test_';

export default async () => {
  console.log('[Global Teardown] Dropping test databases...');
  await dropDatabasesByPrefix(TEST_DBS_PREFIX);
  console.log('[Global Teardown] Test databases dropped');
};
