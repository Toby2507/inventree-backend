import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from './database.service';

const mockDestroy = jest.fn().mockResolvedValue(undefined);
const mockExecute = jest.fn().mockResolvedValue([{ one: 1 }]);

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('kysely', () => ({
  Kysely: jest.fn().mockImplementation(() => ({
    selectNoFrom: jest.fn().mockReturnValue({ execute: mockExecute }),
    destroy: mockDestroy,
  })),
  PostgresDialect: jest.fn(),
}));

describe('DatabaseService', () => {
  let service: DatabaseService;

  beforeEach(async () => {
    jest.clearAllMocks();

    process.env['DB_HOST'] = 'localhost';
    process.env['DB_PORT'] = '5432';
    process.env['DB_NAME'] = 'inventree';
    process.env['DB_USER'] = 'inventree';
    process.env['DB_PASSWORD'] = 'secret';
    process.env['ANALYTICS_DB_HOST'] = 'localhost';
    process.env['ANALYTICS_DB_PORT'] = '5432';
    process.env['ANALYTICS_DB_NAME'] = 'inventree';
    process.env['ANALYTICS_DB_USER'] = 'inventree';
    process.env['ANALYTICS_DB_PASSWORD'] = 'secret';

    const module: TestingModule = await Test.createTestingModule({
      providers: [DatabaseService],
    }).compile();

    service = module.get(DatabaseService);
  });

  describe('before bootstrap', () => {
    it('throws on operational access before bootstrap', () => {
      expect(() => service.operational).toThrow('Operational database not initialised');
    });

    it('throws on analytics access before bootstrap', () => {
      expect(() => service.analytics).toThrow('Analytics database not initialised');
    });
  });

  describe('onApplicationBootstrap', () => {
    it('initialises both pools and verifies connections', async () => {
      await service.onApplicationBootstrap();

      expect(service.operational).toBeDefined();
      expect(service.analytics).toBeDefined();
      expect(mockExecute).toHaveBeenCalledTimes(2);
    });

    it('throws and propagates when operational connection fails', async () => {
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
