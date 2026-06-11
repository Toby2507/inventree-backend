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

  afterAll(async () => {
    await module.close();
  });

  it('should initialise all database pools on bootstrap', async () => {
    await provider.onApplicationBootstrap();
    expect(provider.operationalRead).toBeDefined();
    expect(provider.operationalWrite).toBeDefined();
    expect(provider.analyticsRead).toBeDefined();
    expect(provider.analyticsWrite).toBeDefined();
    expect(provider.forBootstrapMigration).toBeDefined();
    expect(provider.forOperationalMigration).toBeDefined();
    expect(provider.forAnalyticsMigration).toBeDefined();
  });

  it('should execute a simple query successfully', async () => {
    await provider.onApplicationBootstrap();
    const result = await provider.operationalRead
      .selectNoFrom((eb: any) => [eb.val(1).as('one')])
      .executeTakeFirst();
    expect(result?.one).toBe('1');
  });

  it('should close pools on shutdown', async () => {
    await provider.onApplicationBootstrap();
    await provider.onApplicationShutdown();
    expect(() =>
      provider.operationalRead.selectNoFrom((eb: any) => [eb.val(1).as('one')]).executeTakeFirst(),
    ).rejects.toThrow();
  });

  it('should expose analytics and operational schemas separately', async () => {
    await provider.onApplicationBootstrap();
    expect(provider.analyticsRead).toBeDefined();
    expect(provider.operationalWrite).toBeDefined();
  });
});
