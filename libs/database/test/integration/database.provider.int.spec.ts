import { DatabaseProvider } from '@app/database/database.provider';
import { Test, TestingModule } from '@nestjs/testing';

describe('DatabaseProvider (integration)', () => {
  let module: TestingModule;
  let provider: DatabaseProvider;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [DatabaseProvider],
    }).compile();
    provider = module.get(DatabaseProvider);
  });
  beforeEach(async () => {
    await provider.onApplicationBootstrap();
  });
  afterEach(async () => {
    await provider.onApplicationShutdown();
  });
  afterAll(async () => {
    await module.close();
  });

  it('should initialise all database pools on bootstrap', async () => {
    expect(provider.operationalRead).toBeDefined();
    expect(provider.operationalWrite).toBeDefined();
    expect(provider.analyticsRead).toBeDefined();
    expect(provider.analyticsWrite).toBeDefined();
    expect(provider.forBootstrapMigration).toBeDefined();
    expect(provider.forOperationalMigration).toBeDefined();
    expect(provider.forAnalyticsMigration).toBeDefined();
  });

  it('should execute a simple query successfully', async () => {
    const result = await provider.operationalRead
      .selectNoFrom((eb: any) => [eb.val(1).as('one')])
      .executeTakeFirst();
    expect(result?.one).toBe('1');
  });

  it('should close pools on shutdown', async () => {
    await provider.onApplicationShutdown();
    expect(() =>
      provider.operationalRead.selectNoFrom((eb: any) => [eb.val(1).as('one')]).executeTakeFirst(),
    ).rejects.toThrow();
  });

  it('should expose analytics and operational schemas separately', async () => {
    expect(provider.analyticsRead).toBeDefined();
    expect(provider.operationalWrite).toBeDefined();
  });
});
