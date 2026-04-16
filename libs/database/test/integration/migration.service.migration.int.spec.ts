import { Test, TestingModule } from '@nestjs/testing';
import { MigrationModule } from '../../src/migration.module';
import { MigrationService } from '../../src/migration.service';

const MIGRATION_DB = 'integration_migration_db';

jest.setTimeout(30000); // Migrations can take longer than the default 5s Jest timeout, especially on CI. Adjust as needed.
describe('MigrationService (integration)', () => {
  let module: TestingModule;
  let service: MigrationService;

  beforeAll(async () => {
    // Point both pools at the isolated migration DB before NestJS initialises.
    // DatabaseService reads process.env directly — this must happen before module.init().
    process.env['DB_NAME'] = MIGRATION_DB;
    process.env['ANALYTICS_DB_NAME'] = MIGRATION_DB;

    module = await Test.createTestingModule({
      imports: [MigrationModule],
    }).compile();

    await module.init();
    service = module.get(MigrationService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('migrateToLatest runs without error', async () => {
    await service.migrateToLatest();
  });

  it('migrateToLatest is idempotent — safe to run twice', async () => {
    await service.migrateToLatest();
    await service.migrateToLatest();
  });

  it('migrateDown runs without error', async () => {
    await service.migrateDown();
  });

  it('migrateToLatest re-applies after a rollback', async () => {
    await service.migrateToLatest();
    await service.migrateDown();
    await service.migrateToLatest();
  });
});
