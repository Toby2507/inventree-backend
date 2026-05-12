import { getTestDbName } from '@app/testing';

const shouldSetupDatabase = (): boolean => {
  const testPath = expect.getState().testPath ?? '';
  return testPath.endsWith('.int.spec.ts') || testPath.endsWith('.e2e.spec.ts');
};

if (shouldSetupDatabase()) {
  process.env.DB_NAME = getTestDbName();
  jest.setTimeout(30000); // Increase timeout for database setup, if needed
}
