import { OUTBOX_SERVICE } from '@app/core/reliability/outbox';
import { DATABASE_CONTEXT, DatabaseModule, storeContextStorage } from '@app/database';
import { DatabaseContextService } from '@app/database/services/database.context.service';
import { faker } from '@app/testing';
import { fsStoreContext } from '@app/testing/identity';
import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { sql } from 'kysely';

const storeContext = fsStoreContext.generate();

describe('DatabaseContextService (integration)', () => {
  let module: TestingModule;
  let service: DatabaseContextService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseModule],
    }).compile();
    await module.init();
    service = module.get<DatabaseContextService>(DATABASE_CONTEXT);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('command', () => {
    it('should throw UnauthorizedException when no store context is set', async () => {
      await expect(service.command(async () => undefined)).rejects.toThrow(UnauthorizedException);
    });

    it('should set app.current_store_id for the duration of the transaction', async () => {
      await storeContextStorage.run(storeContext, async () => {
        const result = await service.command(async (ctx) => {
          const { rows } = await sql<{ store_id: string }>`
            SELECT current_setting('app.current_store_id', true) AS store_id
          `.execute(ctx.operational);
          return rows[0];
        });
        expect(result?.store_id).toBe(storeContext.storeId);
      });
    });

    it('should clear app.current_store_id after the transaction completes', async () => {
      await storeContextStorage.run(storeContext, async () => {
        await service.command(async () => undefined);
      });
      // Outside the tenant context, setting should not carry over to a new connection
      const result = await service.platformCommand(async (ctx) => {
        const { rows } = await sql<{ store_id: string }>`
          SELECT current_setting('app.current_store_id', true) AS store_id
        `.execute(ctx.operational);
        return rows[0];
      });
      // SET LOCAL scopes the setting to the transaction — it must be null/empty outside
      expect(result?.store_id ?? '').toBe('');
    });

    it('should allow read and writes inside command()', async () => {
      await storeContextStorage.run(storeContext, async () => {
        const email = faker.internet.email();
        const passwordHash = faker.string.alphanumeric(32);
        await expect(
          service.command(async (ctx) => {
            await ctx.operational
              .insertInto('users')
              .values({
                email,
                password_hash: passwordHash,
              })
              .execute();
            await ctx.operational.selectFrom('users').where('email', '=', email).executeTakeFirst();
          }),
        ).resolves.not.toThrow();
      });
    });
  });

  describe('platformCommand', () => {
    it('should execute without requiring a store context', async () => {
      // No storeContextStorage.run() wrapper — should succeed
      await expect(service.platformCommand(async () => 'ok')).resolves.toBe('ok');
    });

    it('should not set app.current_store_id', async () => {
      await storeContextStorage.run(storeContext, async () => {
        const result = await service.platformCommand(async (ctx) => {
          const { rows } = await sql<{ store_id: string }>`
          SELECT current_setting('app.current_store_id', true) AS store_id
        `.execute(ctx.operational);
          return rows[0];
        });
        expect(result?.store_id ?? '').toBe('');
      });
    });
  });

  describe('query', () => {
    it('should throw UnauthorizedException when no store context is set', async () => {
      await expect(service.query(async () => undefined)).rejects.toThrow(UnauthorizedException);
    });

    it('should prevent writes inside query()', async () => {
      await storeContextStorage.run(storeContext, async () => {
        await expect(
          service.query(async (ctx) => {
            await ctx.operational
              .insertInto('users')
              .values({
                email: faker.internet.email(),
                password_hash: faker.string.alphanumeric(32),
              })
              .execute();
          }),
        ).rejects.toThrow();
      });
    });

    it('should set app.current_store_id for the duration of the transaction', async () => {
      await storeContextStorage.run(storeContext, async () => {
        const result = await service.query(async (ctx) => {
          const { rows } = await sql<{ store_id: string }>`
            SELECT current_setting('app.current_store_id', true) AS store_id
          `.execute(ctx.operational);
          return rows[0];
        });
        expect(result?.store_id).toBe(storeContext.storeId);
      });
    });

    it('should clear app.current_store_id after the transaction completes', async () => {
      await storeContextStorage.run(storeContext, async () => {
        await service.query(async () => undefined);
      });
      // Outside the tenant context, setting should not carry over to a new connection
      const result = await service.platformQuery(async (ctx) => {
        const { rows } = await sql<{ store_id: string }>`
          SELECT current_setting('app.current_store_id', true) AS store_id
        `.execute(ctx.operational);
        return rows[0];
      });
      // SET LOCAL scopes the setting to the transaction — it must be null/empty outside
      expect(result?.store_id ?? '').toBe('');
    });
  });

  describe('platformQuery', () => {
    it('should execute without requiring a store context', async () => {
      // No storeContextStorage.run() wrapper — should succeed
      await expect(service.platformQuery(async () => 'ok')).resolves.toBe('ok');
    });

    it('should not set app.current_store_id', async () => {
      await storeContextStorage.run(storeContext, async () => {
        const result = await service.platformQuery(async (ctx) => {
          const { rows } = await sql<{ store_id: string }>`
          SELECT current_setting('app.current_store_id', true) AS store_id
        `.execute(ctx.operational);
          return rows[0];
        });
        expect(result?.store_id ?? '').toBe('');
      });
    });
  });

  describe('event handling', () => {
    let publishAllSpy: jest.SpyInstance;

    const createEvent = () => ({
      eventType: 'TestEvent',
      aggregateType: 'TestAggregate',
      aggregateId: 'test-id',
      occurredAt: new Date(),
      payload: { foo: 'bar' },
    });

    beforeEach(() => {
      const outbox = module.get(OUTBOX_SERVICE);
      publishAllSpy = jest.spyOn(outbox, 'publishAll');
      publishAllSpy.mockResolvedValue(undefined);
    });
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it.each(['command', 'platformCommand'] as const)(
      'should publish events emitted during %s()',
      async (method) => {
        const event = createEvent();
        await storeContextStorage.run(storeContext, async () => {
          await service[method](async (ctx) => {
            ctx.events.emit(event);
          });
        });
        expect(publishAllSpy).toHaveBeenCalledTimes(1);
        expect(publishAllSpy).toHaveBeenCalledWith(
          expect.anything(),
          expect.arrayContaining([
            expect.objectContaining({ eventType: event.eventType, payload: event.payload }),
          ]),
        );
      },
    );

    it.each(['command', 'platformCommand'] as const)(
      'should not publish when no events were emitted during %s()',
      async (method) => {
        await storeContextStorage.run(storeContext, async () => {
          await service[method](async () => {
            // No events pushed to ctx.events
          });
        });
        expect(publishAllSpy).not.toHaveBeenCalled();
      },
    );

    it.each(['command', 'platformCommand'] as const)(
      'should not attempt to publish events if the transaction fails in %s()',
      async (method) => {
        const event = createEvent();
        await expect(
          storeContextStorage.run(storeContext, async () => {
            await service[method](async (ctx) => {
              ctx.events.emit(event);
              // Simulate transaction failure by throwing an error
              throw new Error('Simulated transaction failure');
            });
          }),
        ).rejects.toThrow('Simulated transaction failure');
        expect(publishAllSpy).not.toHaveBeenCalled();
      },
    );

    it.each(['command', 'platformCommand'] as const)(
      'should roll back transaction if event publishing fails in %s()',
      async (method) => {
        const event = createEvent();
        const vals = {
          email: faker.internet.email(),
          password_hash: faker.string.alphanumeric(32),
        };
        publishAllSpy.mockRejectedValue(new Error('Outbox publish failed'));
        await expect(
          storeContextStorage.run(storeContext, async () => {
            await service[method](async (ctx) => {
              ctx.events.emit(event);
              // Attempt to insert a record that would be rolled back
              await ctx.operational.insertInto('users').values(vals).execute();
            });
          }),
        ).rejects.toThrow('Outbox publish failed');
        // Verify that the record was not inserted due to rollback
        const result = await service.platformQuery(async (ctx) => {
          return ctx.operational
            .selectFrom('users')
            .where('email', '=', vals.email)
            .executeTakeFirst();
        });
        expect(result).toBeUndefined();
      },
    );
  });
});
