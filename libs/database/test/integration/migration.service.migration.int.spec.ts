import { ObservabilityModule } from '@app/core/observability';
import { MigrationModule, MigrationService } from '@app/database';
import { createOtelTestHarness } from '@app/testing/core/observability';
import { MIGRATION_TEST_DB_NAME } from '@app/testing/database';
import { Test, TestingModule } from '@nestjs/testing';

jest.setTimeout(60000); // Migrations can take longer than the default 5s Jest timeout, especially on CI. Adjust as needed.
describe('MigrationService (integration)', () => {
  let module: TestingModule;
  let service: MigrationService;

  createOtelTestHarness();

  beforeAll(async () => {
    // Point both pools at the isolated migration DB before NestJS initialises.
    // DatabaseService reads process.env directly — this must happen before module.init().
    process.env['DB_NAME'] = MIGRATION_TEST_DB_NAME;

    module = await Test.createTestingModule({
      imports: [MigrationModule, ObservabilityModule],
    }).compile();

    await module.init();
    service = module.get(MigrationService);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('bootstrap migrations', () => {
    it('should run bootstrap migrations successfully', async () => {
      await service.migrateToLatest('bootstrap');
    });

    it('should not allow rolling back bootstrap migrations', async () => {
      await expect(service.migrateDown('bootstrap')).rejects.toThrow();
    });
  });

  describe('analytics migrations', () => {
    beforeAll(async () => {
      await service.migrateToLatest('bootstrap');
    });

    it('should run analytics migrations successfully', async () => {
      await service.migrateToLatest('analytics');
    });

    it('should run analytics migrations idempotently — safe to run twice', async () => {
      await service.migrateToLatest('analytics');
      await service.migrateToLatest('analytics');
    });

    it('should run analytics rollback migrations without error', async () => {
      await service.migrateDown('analytics');
    });

    it('should re-apply analytics migrations after a rollback', async () => {
      await service.migrateToLatest('analytics');
      await service.migrateDown('analytics');
      await service.migrateToLatest('analytics');
    });
  });

  describe('operational migrations', () => {
    beforeAll(async () => {
      await service.migrateToLatest('bootstrap');
    });

    it('should run operational migrations successfully', async () => {
      await service.migrateToLatest('operational');
    });

    it('should run operational migrations idempotently — safe to run twice', async () => {
      await service.migrateToLatest('operational');
      await service.migrateToLatest('operational');
    });

    it('should run operational rollback migrations without error', async () => {
      await service.migrateDown('operational');
    });

    it('should re-apply operational migrations after a rollback', async () => {
      await service.migrateToLatest('operational');
      await service.migrateDown('operational');
      await service.migrateToLatest('operational');
    });
  });
});
