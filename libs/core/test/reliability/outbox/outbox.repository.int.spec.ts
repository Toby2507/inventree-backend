import { DomainEvent } from '@app/common/bases';
import { Mutable } from '@app/common/types';
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

  const obsCtx = {
    serialized: fsSerializedOutboxContext.generate({ actorStoreId: undefined }),
    traceId: faker.string.uuid(),
    spanId: faker.string.uuid(),
  };

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
      const record = { events: feOutboxEvent.generateMany(1), ctx: obsCtx };
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

  describe('claimBatch', () => {
    const ctx = obsCtx;

    it('should claim a batch of pending events and return them for processing', async () => {
      const events = feOutboxEvent.generateMany(3);
      await repo.insert(db, { events, ctx });
      const claimed = await repo.claimBatch(db, 10, 'test-worker', 30000);
      expect(claimed).toHaveLength(3);
      expect(claimed[0].status).toBe('locked');
      expect(claimed[0].lockedBy).toBe('test-worker');
      const rows = await db.selectFrom('outbox_events').selectAll().execute();
      rows.forEach((row) => {
        expect(row.status).toBe('locked');
        expect(row.locked_by).toBe('test-worker');
        expect(row.locked_at).not.toBeNull();
        expect(row.lock_expires_at).not.toBeNull();
      });
    });

    it('should only claim events up to the specified limit', async () => {
      const events = feOutboxEvent.generateMany(5);
      await repo.insert(db, { events, ctx });
      const claimed = await repo.claimBatch(db, 3, 'test-worker', 30000);
      expect(claimed).toHaveLength(3);
      const rows = await db.selectFrom('outbox_events').selectAll().execute();
      const lockedCount = rows.filter((row) => row.status === 'locked').length;
      expect(lockedCount).toBe(3);
    });

    it('should not claim any event if limit is set to 0', async () => {
      const events = feOutboxEvent.generateMany(5);
      await repo.insert(db, { events, ctx });
      const claimed = await repo.claimBatch(db, 0, 'test-worker', 30000);
      expect(claimed).toHaveLength(0);
      const rows = await db.selectFrom('outbox_events').selectAll().execute();
      const lockedCount = rows.filter((row) => row.status === 'locked').length;
      expect(lockedCount).toBe(0);
    });

    it('should not claim already locked events', async () => {
      const events = feOutboxEvent.generateMany(2);
      await repo.insert(db, { events, ctx });
      // Lock one event with a different worker
      await repo.claimBatch(db, 1, 'test-worker', 30000);
      const claimed = await repo.claimBatch(db, 10, 'test-worker-2', 30000);
      expect(claimed).toHaveLength(1);
    });

    it('should not claim events that are not yet due for retry', async () => {
      const events = feOutboxEvent.generateMany(1);
      await repo.insert(db, { events, ctx });
      await db.updateTable('outbox_events').set({ next_attempt_at: faker.date.future() }).execute();
      const claimed = await repo.claimBatch(db, 10, 'test-worker', 30000);
      expect(claimed).toHaveLength(0);
    });

    it('should claim events in order of occurrence from oldest to newest', async () => {
      const event1 = feOutboxEvent.generate();
      (event1 as Mutable<DomainEvent>).occurredAt = new Date(Date.now() - 10000);
      const event2 = feOutboxEvent.generate();
      await repo.insert(db, { events: [event2, event1], ctx });
      const claimed = await repo.claimBatch(db, 1, 'test-worker', 30000);
      expect(claimed[0].aggregateId).toBe(event1.aggregateId);
    });

    it('should not allow two workers to claim the same event concurrently', async () => {
      const events = feOutboxEvent.generateMany(1);
      await repo.insert(db, { events, ctx });
      const [claimed1, claimed2] = await Promise.all([
        repo.claimBatch(db, 1, 'worker-1', 30000),
        repo.claimBatch(db, 1, 'worker-2', 30000),
      ]);
      const total = [...claimed1, ...claimed2];
      expect(total).toHaveLength(1);
      expect(total[0].lockedBy).toBeDefined();
      expect(['worker-1', 'worker-2']).toContain(total[0].lockedBy);
      expect(claimed1.length !== claimed2.length).toBe(true);
    });

    it('should not re-claim already locked events by the same worker', async () => {
      const events = feOutboxEvent.generateMany(1);
      await repo.insert(db, { events, ctx });
      const claimed1 = await repo.claimBatch(db, 1, 'worker-1', 30000);
      const claimed2 = await repo.claimBatch(db, 1, 'worker-1', 30000);
      expect(claimed1.length).toBe(1);
      expect(claimed2.length).toBe(0);
    });
  });

  describe('markPublished', () => {
    let eventId: string;

    const getEvent = async () =>
      db.selectFrom('outbox_events').selectAll().where('id', '=', eventId).executeTakeFirst();

    beforeEach(async () => {
      await repo.insert(db, { events: feOutboxEvent.generateMany(1), ctx: obsCtx });
      const rows = await db.selectFrom('outbox_events').selectAll().execute();
      eventId = rows[0].id;
    });

    it('should mark the specified events as published', async () => {
      await repo.markPublished(db, [eventId], 'test-worker');
      const row = await getEvent();
      expect(row?.status).toBe('published');
      expect(row?.publish_ref).toBe('test-worker');
      expect(row?.published_at).not.toBeNull();
    });

    it('should clear lock fields when marking as published', async () => {
      await repo.markPublished(db, [eventId], 'test-worker');
      const row = await getEvent();
      expect(row?.locked_at).toBeNull();
      expect(row?.locked_by).toBeNull();
      expect(row?.lock_expires_at).toBeNull();
    });

    it('should do nothing if no IDs are provided', async () => {
      await expect(repo.markPublished(db, [], 'test-worker')).resolves.not.toThrow();
      const rows = await db.selectFrom('outbox_events').selectAll().execute();
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('pending');
    });

    it('should be idempotent when marking the same event as published multiple times', async () => {
      await repo.markPublished(db, [eventId], 'test-worker');
      await expect(repo.markPublished(db, [eventId], 'test-worker')).resolves.not.toThrow();
      const row = await getEvent();
      expect(row?.status).toBe('published');
      expect(row?.publish_ref).toBe('test-worker');
    });
  });

  describe('markFailed', () => {
    let eventId: string;

    const getEvent = async () =>
      db.selectFrom('outbox_events').selectAll().where('id', '=', eventId).executeTakeFirst();

    beforeEach(async () => {
      await repo.insert(db, { events: feOutboxEvent.generateMany(1), ctx: obsCtx });
      const rows = await db.selectFrom('outbox_events').selectAll().execute();
      eventId = rows[0].id;
    });

    it('should requeue the event for retry if not dead-lettered', async () => {
      const nextAttemptAt = new Date(Date.now() + 60000); // 1 minute later
      await repo.markFailed(db, eventId, 'Temporary error', nextAttemptAt, false);
      const row = await getEvent();
      expect(row?.status).toBe('pending');
      expect(row?.next_attempt_at).toEqual(nextAttemptAt);
      expect(row?.last_error).toBe('Temporary error');
      expect(row?.last_error_at).not.toBeNull();
      expect(row?.publish_attempts).toBe(1);
    });

    it('should mark the event as failed if dead-lettered', async () => {
      await repo.markFailed(db, eventId, 'Permanent error', new Date(), true);
      const row = await getEvent();
      expect(row?.status).toBe('failed');
      expect(row?.next_attempt_at).toBeNull();
      expect(row?.last_error).toBe('Permanent error');
      expect(row?.last_error_at).not.toBeNull();
      expect(row?.publish_attempts).toBe(1);
    });

    it('should increment publish_attempts on each failure', async () => {
      const row = await getEvent();
      expect(row?.publish_attempts).toBe(0);
      await repo.markFailed(db, eventId, 'Error 1', new Date(), false);
      const rowAfterFirstFailure = await db
        .selectFrom('outbox_events')
        .selectAll()
        .where('id', '=', eventId)
        .executeTakeFirst();
      expect(rowAfterFirstFailure?.publish_attempts).toBe(1);
    });

    it('should clear lock fields when marking as failed', async () => {
      await repo.markFailed(db, eventId, 'Error', new Date(), false);
      const row = await getEvent();
      expect(row?.locked_at).toBeNull();
      expect(row?.locked_by).toBeNull();
      expect(row?.lock_expires_at).toBeNull();
    });
  });

  describe('releaseExpiredLocks', () => {
    beforeEach(async () => {
      await repo.insert(db, { events: feOutboxEvent.generateMany(1), ctx: obsCtx });
    });

    it('should release locks that have expired', async () => {
      await repo.claimBatch(db, 1, 'test-worker', -1000);
      await repo.releaseExpiredLocks(db);
      const row = await db.selectFrom('outbox_events').selectAll().executeTakeFirst();
      expect(row?.status).toBe('pending');
      expect(row?.locked_at).toBeNull();
      expect(row?.locked_by).toBeNull();
      expect(row?.lock_expires_at).toBeNull();
    });

    it('should not release locks that have not expired', async () => {
      await repo.claimBatch(db, 1, 'test-worker', 5000);
      await repo.releaseExpiredLocks(db);
      const row = await db.selectFrom('outbox_events').selectAll().executeTakeFirst();
      expect(row?.status).toBe('locked');
      expect(row?.locked_by).toBe('test-worker');
    });

    it('should not affect events that are not locked', async () => {
      await repo.releaseExpiredLocks(db);
      const row = await db.selectFrom('outbox_events').selectAll().executeTakeFirst();
      expect(row?.status).toBe('pending');
    });
  });
});
