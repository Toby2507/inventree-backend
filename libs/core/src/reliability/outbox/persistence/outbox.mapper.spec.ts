import { faker } from '@app/testing';
import { fsSerializedOutboxContext } from '@app/testing/core/observability';
import { fdOutboxEvent, feOutboxEvent, fsOutboxEvent } from '@app/testing/core/reliability/outbox';
import { OutboxEventMapper } from './outbox.mapper';

describe('Outbox Event Mapper', () => {
  let mapper: OutboxEventMapper;
  beforeEach(() => {
    mapper = new OutboxEventMapper();
  });

  describe('toDomain()', () => {
    it('should map persistence data to domain aggregate', () => {
      const row = fdOutboxEvent.generate();
      const event = mapper.toDomain(row);
      expect(event).toMatchObject({
        id: row.id,
        storeId: row.store_id,
        destination: row.destination,
        status: row.status,
        eventType: row.event_type,
        schemaVersion: row.schema_version,
        aggregateType: row.aggregate_type,
        aggregateId: row.aggregate_id,
        traceId: row.trace_id,
        correlationId: row.correlation_id,
        causationId: row.causation_id,
        partitionKey: row.partition_key,
        payload: row.payload,
        lockedBy: row.locked_by,
        publishAttempts: row.publish_attempts,
        publishRef: row.publish_ref,
        lastError: row.last_error,
      });
      expect(event.occurredAt.toEpochMs()).toBe(row.occurred_at.getTime());
      expect(event.lockedAt?.toEpochMs()).toBe(row.locked_at?.getTime());
      expect(event.lockExpiresAt?.toEpochMs()).toBe(row.lock_expires_at?.getTime());
      expect(event.nextAttemptAt?.toEpochMs()).toBe(row.next_attempt_at?.getTime());
      expect(event.publishedAt?.toEpochMs()).toBe(row.published_at?.getTime());
      expect(event.lastErrorAt?.toEpochMs()).toBe(row.last_error_at?.getTime());
      expect(event.createdAt.toEpochMs()).toBe(row.created_at.getTime());
    });

    it('should map null values correctly', () => {
      const row = fdOutboxEvent.generate({
        trace_id: null,
        correlation_id: null,
        causation_id: null,
      });
      const event = mapper.toDomain(row);
      expect(event.traceId).toBeNull();
      expect(event.correlationId).toBeNull();
      expect(event.causationId).toBeNull();
    });
  });

  describe('toPersistence()', () => {
    it('should map domain aggregate to persistence data', () => {
      const event = fsOutboxEvent.generate();
      const row = mapper.toPersistence(event);
      expect(row).toMatchObject({
        id: event.id,
        store_id: event.storeId,
        destination: event.destination,
        status: event.status,
        event_type: event.eventType,
        schema_version: event.schemaVersion,
        aggregate_type: event.aggregateType,
        aggregate_id: event.aggregateId,
        trace_id: event.traceId,
        correlation_id: event.correlationId,
        causation_id: event.causationId,
        partition_key: event.partitionKey,
        payload: event.payload,
        locked_by: event.lockedBy,
        publish_attempts: event.publishAttempts,
        publish_ref: event.publishRef,
        last_error: event.lastError,
      });
      expect(row.occurred_at.getTime()).toBe(event.occurredAt.toEpochMs());
      expect(row.locked_at?.getTime()).toBe(event.lockedAt?.toEpochMs());
      expect(row.lock_expires_at?.getTime()).toBe(event.lockExpiresAt?.toEpochMs());
      expect(row.next_attempt_at?.getTime()).toBe(event.nextAttemptAt?.toEpochMs());
      expect(row.published_at?.getTime()).toBe(event.publishedAt?.toEpochMs());
      expect(row.last_error_at?.getTime()).toBe(event.lastErrorAt?.toEpochMs());
      expect(row.created_at.getTime()).toBe(event.createdAt.toEpochMs());
    });

    it('should map null values correctly in persistence data', () => {
      const event = fsOutboxEvent.generate({
        traceId: null,
        correlationId: null,
        causationId: null,
      });
      const persistence = mapper.toPersistence(event);
      expect(persistence.trace_id).toBeNull();
      expect(persistence.correlation_id).toBeNull();
      expect(persistence.causation_id).toBeNull();
    });
  });

  describe('toPublish()', () => {
    it('should map domain events to persistence data for publishing', () => {
      const events = feOutboxEvent.generateMany(1);
      const ctx = {
        serialized: fsSerializedOutboxContext.generate(),
        traceId: faker.string.uuid(),
        spanId: faker.string.uuid(),
      };
      const result = mapper.toPublish({ events, ctx });
      expect(result).toHaveLength(events.length);
      expect(result[0]).toMatchObject({
        store_id: ctx.serialized.actorStoreId,
        destination: 'bullmq',
        status: 'pending',
        event_type: events[0].eventType,
        schema_version: 1,
        aggregate_type: events[0].aggregateType,
        aggregate_id: events[0].aggregateId,
        trace_id: ctx.traceId,
        correlation_id: ctx.serialized.correlationId,
        causation_id: ctx.serialized.causationId,
        partition_key: ctx.serialized.correlationId,
        payload: {
          data: events[0].payload,
          _obs: ctx.serialized,
        },
        publish_attempts: 0,
      });
      expect((result[0].occurred_at as Date).getTime()).toBe(events[0].occurredAt.toEpochMs());
    });

    it('should default to null for optional context values', () => {
      const events = feOutboxEvent.generateMany(1);
      const [result] = mapper.toPublish({ events, ctx: {} });
      expect(result.trace_id).toBeNull();
      expect(result.correlation_id).toBeNull();
      expect(result.causation_id).toBeNull();
      expect(result.partition_key).toBe(events[0].aggregateId);
    });

    it('should default to fallback values if available', () => {
      const events = feOutboxEvent.generateMany(1);
      const ctx = {
        serialized: fsSerializedOutboxContext.generate({
          causationId: undefined,
          correlationId: undefined,
        }),
        traceId: faker.string.uuid(),
        spanId: faker.string.uuid(),
      };
      const [result] = mapper.toPublish({ events, ctx });
      expect(result.causation_id).toBe(ctx.spanId);
      expect(result.partition_key).toBe(ctx.serialized.actorStoreId);
    });
  });
});
