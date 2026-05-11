import 'tsconfig-paths/register';
import { dropTestDB } from '@app/testing';

const MIGRATION_TEST_DB = 'integration_migration_db';

export default async (): Promise<void> => {
  console.log('[Global Teardown] Dropping migration test database...');
  await dropTestDB(MIGRATION_TEST_DB);
  console.log('[Global Teardown] Migration test database dropped');
};
