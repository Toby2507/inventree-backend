import { DatabaseProvider } from '@app/database/database.provider';
import { Test, TestingModule } from '@nestjs/testing';

describe('DatabaseProvider (integration)', () => {
  let module: TestingModule;
  let provider: DatabaseProvider;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [DatabaseProvider],
    }).compile();
    await module.init();
    provider = module.get(DatabaseProvider);
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
    expect(provider.notificationClient).toBeDefined();
  });

  it('should execute a simple query successfully', async () => {
    const result = await provider.operationalRead
      .selectNoFrom((eb: any) => [eb.val(1).as('one')])
      .executeTakeFirst();
    expect(result?.one).toBe('1');
  });

  it('should expose analytics and operational schemas separately', async () => {
    expect(provider.analyticsRead).toBeDefined();
    expect(provider.operationalWrite).toBeDefined();
  });

  it('should connect the notification client and subscribe to a channel', async () => {
    await expect(provider.notificationClient.query('LISTEN outbox_pending')).resolves.not.toThrow();
  });

  it('should handle notification client errors without throwing', () => {
    expect(() => {
      provider.notificationClient.emit('error', new Error('simulated disconnect'));
    }).not.toThrow();
  });

  describe('shutdown', () => {
    let shutdownModule: TestingModule;
    let shutdownProvider: DatabaseProvider;

    beforeAll(async () => {
      shutdownModule = await Test.createTestingModule({
        providers: [DatabaseProvider],
      }).compile();
      shutdownProvider = shutdownModule.get(DatabaseProvider);
      await shutdownModule.init();
    });

    it('should close all pools and the notification client on shutdown', async () => {
      await shutdownProvider.onApplicationShutdown();
      await expect(
        shutdownProvider.operationalRead
          .selectNoFrom((eb: any) => [eb.val(1).as('one')])
          .executeTakeFirst(),
      ).rejects.toThrow();
      await expect(shutdownProvider.notificationClient.query('SELECT 1')).rejects.toThrow();
    });
  });
});
