import 'tsconfig-paths/register';
import { dropTestDB, MIGRATION_TEST_DB_NAME } from '@app/testing';

export default async (): Promise<void> => {
  console.log('[Global Teardown] Dropping migration test database...');
  await dropTestDB(MIGRATION_TEST_DB_NAME);
  console.log('[Global Teardown] Migration test database dropped');
};
