import { Test, TestingModule } from '@nestjs/testing';
import { MigrationModule } from '../../src/migration.module';
import { MigrationService } from '../../src/migration.service';

const MIGRATION_DB = 'integration_migration_db';

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
    await expect(service.migrateToLatest()).resolves.not.toThrow();
  }, 30000); // allow extra time for migrations to run

  it('migrateToLatest is idempotent — safe to run twice', async () => {
    await expect(service.migrateToLatest()).resolves.not.toThrow();
    await expect(service.migrateToLatest()).resolves.not.toThrow();
  }, 30000); // allow extra time for migrations to run

  it('migrateDown runs without error when no migrations exist', async () => {
    await expect(service.migrateDown()).resolves.not.toThrow();
  }, 30000); // allow extra time for migrations to run

  it('migrateToLatest re-applies after a rollback', async () => {
    await expect(service.migrateToLatest()).resolves.not.toThrow();
  }, 30000); // allow extra time for migrations to run
});
