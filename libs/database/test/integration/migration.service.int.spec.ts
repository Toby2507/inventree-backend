import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { MigrationModule } from '../../src/migration.module';
import { MigrationService } from '../../src/migration.service';

describe('MigrationService (integration)', () => {
  let module: TestingModule;
  let service: MigrationService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), MigrationModule],
    }).compile();

    await module.init();
    service = module.get(MigrationService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('migrateToLatest runs without error', async () => {
    await expect(service.migrateToLatest()).resolves.not.toThrow();
  });

  it('migrateToLatest is idempotent — safe to run twice', async () => {
    await expect(service.migrateToLatest()).resolves.not.toThrow();
    await expect(service.migrateToLatest()).resolves.not.toThrow();
  });

  it('migrateDown runs without error when no migrations exist', async () => {
    // With an empty migrations set, down is a no-op — should not throw
    await expect(service.migrateDown()).resolves.not.toThrow();
  });
});
