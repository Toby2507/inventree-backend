import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { sql } from 'kysely';
import { DatabaseModule } from '../../src/database.module';
import { StoreContext, storeContextStorage } from '../../src/store-context';
import { TenantDatabaseService } from '../../src/tenant-database.service';

const storeContext: StoreContext = {
  storeId: 'test-store-id',
  businessId: 'test-biz-id',
  userId: 'test-user-id',
  storeMemberId: 'test-member-id',
  role: 'owner',
};

describe('TenantDatabaseService (integration)', () => {
  let module: TestingModule;
  let service: TenantDatabaseService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule],
    }).compile();

    await module.init();
    service = module.get(TenantDatabaseService);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('runInTenantContext', () => {
    it('throws UnauthorizedException when no store context is set', async () => {
      await expect(service.runInTenantContext(async () => undefined)).rejects.toThrow(
        'No store context found on request',
      );
    });

    it('sets app.current_store_id for the duration of the transaction', async () => {
      await storeContextStorage.run(storeContext, async () => {
        const result = await service.runInTenantContext(async (trx) => {
          const { rows } = await sql<{ store_id: string }>`
            SELECT current_setting('app.current_store_id', true) AS store_id
          `.execute(trx);
          return rows[0];
        });

        expect(result?.store_id).toBe(storeContext.storeId);
      });
    });

    it('clears app.current_store_id after the transaction completes', async () => {
      await storeContextStorage.run(storeContext, async () => {
        await service.runInTenantContext(async () => undefined);
      });

      // Outside the tenant context, setting should not carry over to a new connection
      const result = await service.runAsSystem(async (trx) => {
        const { rows } = await sql<{ store_id: string }>`
          SELECT current_setting('app.current_store_id', true) AS store_id
        `.execute(trx);
        return rows[0];
      });

      // SET LOCAL scopes the setting to the transaction — it must be null/empty outside
      expect(result?.store_id ?? '').toBe('');
    });
  });

  describe('runAsSystem', () => {
    it('executes without requiring a store context', async () => {
      // No storeContextStorage.run() wrapper — should succeed
      await expect(service.runAsSystem(async () => 'ok')).resolves.toBe('ok');
    });

    it('does not set app.current_store_id', async () => {
      const result = await service.runAsSystem(async (trx) => {
        const { rows } = await sql<{ store_id: string }>`
          SELECT current_setting('app.current_store_id', true) AS store_id
        `.execute(trx);
        return rows[0];
      });

      expect(result?.store_id ?? '').toBe('');
    });
  });

  describe('passthrough getters', () => {
    it('exposes the operational Kysely instance', () => {
      expect(service.operational).toBeDefined();
    });

    it('exposes the analytics Kysely instance', () => {
      expect(service.analytics).toBeDefined();
    });
  });
});
