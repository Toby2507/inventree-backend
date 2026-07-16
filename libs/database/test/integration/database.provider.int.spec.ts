import { databaseConfig } from '@app/config';
import { LOGGER } from '@app/core/observability';
import { DatabaseProvider } from '@app/database/database.provider';
import { makeLoggerMock } from '@app/testing/core/observability';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

describe('DatabaseProvider (integration)', () => {
  let module: TestingModule;
  let provider: DatabaseProvider;

  const { logger, contextLogger } = makeLoggerMock();

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ load: [databaseConfig] })],
      providers: [DatabaseProvider, { provide: LOGGER, useValue: logger }],
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

  describe('notification connection factory', () => {
    it('should create a notification client successfully', async () => {
      const client = await provider.createNotificationClient();
      expect(client).toBeDefined();
      const result = await client.query('SELECT now()');
      expect(result.rowCount).toBe(1);
    });

    it('should handle created client errors without throwing', async () => {
      const client = await provider.createNotificationClient();
      expect(() => {
        client.emit('error', new Error('simulated disconnect'));
      }).not.toThrow();
      expect(contextLogger.error).toHaveBeenCalledWith('Notification client error', {
        error: 'simulated disconnect',
      });
    });

    it('should destroy a notification client successfully', async () => {
      const client = await provider.createNotificationClient();
      await expect(provider.destroyNotificationClient(client)).resolves.not.toThrow();
      expect(contextLogger.log).toHaveBeenCalledWith('Notification client disconnected');
      await expect(client.query('SELECT now()')).rejects.toThrow();
    });

    it('should create independent notification clients', async () => {
      const [c1, c2] = await Promise.all([
        provider.createNotificationClient(),
        provider.createNotificationClient(),
      ]);
      expect(c1).not.toBe(c2);
      await provider.destroyNotificationClient(c1);
      await expect(c1.query('SELECT now()')).rejects.toThrow();
      await expect(c2.query('SELECT now()')).resolves.not.toThrow();
    });
  });

  describe('shutdown', () => {
    let shutdownModule: TestingModule;
    let shutdownProvider: DatabaseProvider;

    beforeAll(async () => {
      shutdownModule = await Test.createTestingModule({
        imports: [ConfigModule.forRoot({ load: [databaseConfig] })],
        providers: [DatabaseProvider, { provide: LOGGER, useValue: logger }],
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
    });
  });
});
