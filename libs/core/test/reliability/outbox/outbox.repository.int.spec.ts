import { OutboxKyselyRepository } from '@app/core/reliability/outbox/persistence/outbox.kysely.repository';
import { OperationalDB, OperationalSchema } from '@app/database';
import { faker } from '@app/testing';
import { fsSerializedOutboxContext } from '@app/testing/core/observability';
import { feOutboxEvent } from '@app/testing/core/reliability/outbox';
import { createTestContext, TestContext } from '@app/testing/database';

describe('OutboxKyselyRepository (integration)', () => {
  let ctx: TestContext<OperationalSchema>;
  let db: OperationalDB;
  let repo: OutboxKyselyRepository;

  beforeAll(async () => {
    ctx = await createTestContext();
    repo = new OutboxKyselyRepository();
  });
  beforeEach(async () => {
    db = await ctx.begin();
  });
  afterEach(async () => {
    await ctx.rollback();
  });
  afterAll(async () => {
    await ctx.dispose();
  });

  describe('insert', () => {
    it('should insert events into the outbox table', async () => {
      const record = {
        events: feOutboxEvent.generateMany(1),
        ctx: {
          serialized: fsSerializedOutboxContext.generate({ actorStoreId: undefined }),
          traceId: faker.string.uuid(),
          spanId: faker.string.uuid(),
        },
      };
      await repo.insert(db, record);
      const rows = await db.selectFrom('outbox_events').selectAll().execute();
      expect(rows).toHaveLength(1);
      const [row] = rows;
      const [event] = record.events;
      expect(row.payload).toEqual(
        expect.objectContaining({
          data: event.payload,
          _obs: expect.objectContaining({ correlationId: record.ctx.serialized.correlationId }),
        }),
      );
      expect(row.trace_id).toBe(record.ctx.traceId);
      expect(row.correlation_id).toBe(record.ctx.serialized.correlationId);
    });
  });
});
