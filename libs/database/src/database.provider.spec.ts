import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseProvider } from './database.provider';

const mockDestroy = jest.fn().mockResolvedValue(undefined);
const mockExecute = jest.fn().mockResolvedValue([{ one: 1 }]);

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('kysely', () => ({
  Kysely: jest.fn().mockImplementation(() => ({
    selectNoFrom: jest.fn().mockReturnValue({ executeTakeFirst: mockExecute }),
    destroy: mockDestroy,
    withSchema: jest.fn().mockReturnThis(),
  })),
  PostgresDialect: jest.fn(),
}));

describe('DatabaseProvider', () => {
  let service: DatabaseProvider;

  beforeEach(async () => {
    jest.clearAllMocks();

    process.env['DB_HOST'] = 'localhost';
    process.env['DB_PORT'] = '5432';
    process.env['DB_NAME'] = 'inventree';
    process.env['DB_USER'] = 'inventree';
    process.env['DB_PASSWORD'] = 'secret';

    const module: TestingModule = await Test.createTestingModule({
      providers: [DatabaseProvider],
    }).compile();

    service = module.get(DatabaseProvider);
  });

  describe('before bootstrap', () => {
    it('should throw on migration access before bootstrap', () => {
      expect(() => service.forBootstrapMigration).toThrow('Operational database not initialised');
      expect(() => service.forAnalyticsMigration).toThrow('Analytics database not initialised');
      expect(() => service.forOperationalMigration).toThrow('Operational database not initialised');
    });

    it('throws on analytics access before bootstrap', () => {
      expect(() => service.analyticsRead).toThrow('Analytics database not initialised');
      expect(() => service.analyticsWrite).toThrow('Analytics database not initialised');
    });

    it('throws on operational access before bootstrap', () => {
      expect(() => service.operationalRead).toThrow('Operational database not initialised');
      expect(() => service.operationalWrite).toThrow('Operational database not initialised');
    });
  });

  describe('onApplicationBootstrap', () => {
    it('initialises both pools and verifies connections', async () => {
      await service.onApplicationBootstrap();
      expect(service.operationalRead).toBeDefined();
      expect(service.operationalWrite).toBeDefined();
      expect(service.analyticsRead).toBeDefined();
      expect(service.analyticsWrite).toBeDefined();
      expect(service.forBootstrapMigration).toBeDefined();
      expect(service.forOperationalMigration).toBeDefined();
      expect(service.forAnalyticsMigration).toBeDefined();
      expect(mockExecute).toHaveBeenCalledTimes(2);
    });

    it('throws and propagates when database connection fails', async () => {
      mockExecute.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      await expect(service.onApplicationBootstrap()).rejects.toThrow('ECONNREFUSED');
    });
  });

  describe('onApplicationShutdown', () => {
    it('destroys both pools', async () => {
      await service.onApplicationBootstrap();
      await service.onApplicationShutdown();
      expect(mockDestroy).toHaveBeenCalledTimes(2);
    });
  });
});
