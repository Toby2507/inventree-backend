import { faker } from '@app/testing';
import { fsSerializedOutboxContext } from '@app/testing/core/observability';
import { fdOutboxEvent, feOutboxEvent, fsOutboxEvent } from '@app/testing/core/reliability/outbox';
import { OutboxEventMapper } from './outbox.mapper';

describe('Outbox Event Mapper', () => {
  let mapper: OutboxEventMapper;
  beforeEach(() => {
    mapper = new OutboxEventMapper();
  });

  describe('OutboxEventMapper.toDomain()', () => {
    it('should map persistence data to domain aggregate', () => {
      const row = fdOutboxEvent.generate();
      expect(mapper.toDomain(row)).toEqual({
        id: row.id,
        storeId: row.store_id,
        destination: row.destination,
        status: row.status,
        eventType: row.event_type,
        schemaVersion: row.schema_version,
        aggregateType: row.aggregate_type,
        aggregateId: row.aggregate_id,
        occurredAt: row.occurred_at,
        traceId: row.trace_id,
        correlationId: row.correlation_id,
        causationId: row.causation_id,
        partitionKey: row.partition_key,
        payload: row.payload,
        lockedAt: row.locked_at,
        lockedBy: row.locked_by,
        lockExpiresAt: row.lock_expires_at,
        publishAttempts: row.publish_attempts,
        nextAttemptAt: row.next_attempt_at,
        publishedAt: row.published_at,
        publishRef: row.publish_ref,
        lastError: row.last_error,
        lastErrorAt: row.last_error_at,
        createdAt: row.created_at,
      });
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

  describe('OutboxEventMapper.toPersistence()', () => {
    it('should map domain aggregate to persistence data', () => {
      const event = fsOutboxEvent.generate();
      expect(mapper.toPersistence(event)).toEqual({
        id: event.id,
        store_id: event.storeId,
        destination: event.destination,
        status: event.status,
        event_type: event.eventType,
        schema_version: event.schemaVersion,
        aggregate_type: event.aggregateType,
        aggregate_id: event.aggregateId,
        occurred_at: event.occurredAt,
        trace_id: event.traceId,
        correlation_id: event.correlationId,
        causation_id: event.causationId,
        partition_key: event.partitionKey,
        payload: event.payload,
        locked_at: event.lockedAt,
        locked_by: event.lockedBy,
        lock_expires_at: event.lockExpiresAt,
        publish_attempts: event.publishAttempts,
        next_attempt_at: event.nextAttemptAt,
        published_at: event.publishedAt,
        publish_ref: event.publishRef,
        last_error: event.lastError,
        last_error_at: event.lastErrorAt,
        created_at: event.createdAt,
      });
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

  describe('OutboxEventMapper.toPublish()', () => {
    it('should map domain events to persistence data for publishing', () => {
      const events = feOutboxEvent.generateMany(1);
      const ctx = {
        serialized: fsSerializedOutboxContext.generate(),
        traceId: faker.string.uuid(),
        spanId: faker.string.uuid(),
      };
      const result = mapper.toPublish({ events, ctx });
      expect(result).toHaveLength(events.length);
      expect(result[0]).toEqual({
        store_id: ctx.serialized.actorStoreId,
        destination: 'bullmq',
        status: 'pending',
        event_type: events[0].eventType,
        schema_version: 1,
        aggregate_type: events[0].aggregateType,
        aggregate_id: events[0].aggregateId,
        occurred_at: events[0].occurredAt,
        trace_id: ctx.traceId,
        correlation_id: ctx.serialized.correlationId,
        causation_id: ctx.serialized.causationId,
        partition_key: ctx.serialized.correlationId,
        payload: {
          ...events[0].payload,
          _obs: ctx.serialized,
        },
        publish_attempts: 0,
      });
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
