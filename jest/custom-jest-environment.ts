import 'tsconfig-paths/register';
import { cloneDatabase, getTestDbName, TEMPLATE_DB_NAME } from '@app/testing';
import NodeEnvironment from 'jest-environment-node';

export default class CustomEnvironment extends NodeEnvironment {
  private readonly testPath: string;

  constructor(config: any, context: any) {
    super(config, context);
    this.testPath = context.testPath;
  }

  async setup() {
    await super.setup();
    if (!this.shouldSetupDatabase()) return;
    await this.setupDatabase();
  }

  private shouldSetupDatabase = (): boolean => {
    return (
      (this.testPath.endsWith('.int.spec.ts') || this.testPath.endsWith('.e2e.spec.ts')) &&
      !this.testPath.endsWith('migration.int.spec.ts')
    );
  };

  private setupDatabase = async () => {
    const testDbName = getTestDbName();
    await cloneDatabase(TEMPLATE_DB_NAME, testDbName);
  };
}
