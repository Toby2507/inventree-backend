import { cloneDatabase, getTestDbName } from '@app/testing';

const setupDatabase = async () => {
  const testDbName = getTestDbName();
  await cloneDatabase('integration_template', testDbName);
};

beforeAll(async () => {
  process.env.DB_NAME = getTestDbName();
  await setupDatabase();
});
