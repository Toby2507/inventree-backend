import { Instant, type JsonValue, Mapper } from '@app/shared-kernel';
import type {
  CreateOutboxEvent,
  NewOutboxEventRow,
  OutboxEvent,
  OutboxEventRow,
} from '../types/outbox.interface';

export class OutboxEventMapper extends Mapper<OutboxEvent, OutboxEventRow> {
  toDomain(row: OutboxEventRow): OutboxEvent {
    return {
      id: row.id!,
      storeId: row.store_id,
      destination: row.destination!,
      status: row.status!,
      eventType: row.event_type,
      schemaVersion: row.schema_version!,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      occurredAt: Instant.fromDate(row.occurred_at),
      traceId: row.trace_id,
      correlationId: row.correlation_id,
      causationId: row.causation_id,
      partitionKey: row.partition_key,
      payload: row.payload,
      lockedAt: row.locked_at ? Instant.fromDate(row.locked_at) : null,
      lockedBy: row.locked_by,
      lockExpiresAt: row.lock_expires_at ? Instant.fromDate(row.lock_expires_at) : null,
      publishAttempts: row.publish_attempts!,
      nextAttemptAt: row.next_attempt_at ? Instant.fromDate(row.next_attempt_at) : null,
      publishedAt: row.published_at ? Instant.fromDate(row.published_at) : null,
      publishRef: row.publish_ref,
      lastError: row.last_error,
      lastErrorAt: row.last_error_at ? Instant.fromDate(row.last_error_at) : null,
      createdAt: Instant.fromDate(row.created_at),
    };
  }

  toPersistence(record: OutboxEvent): OutboxEventRow {
    return {
      id: record.id,
      store_id: record.storeId ?? null,
      destination: record.destination,
      status: record.status,
      event_type: record.eventType,
      schema_version: record.schemaVersion,
      aggregate_type: record.aggregateType ?? null,
      aggregate_id: record.aggregateId ?? null,
      occurred_at: record.occurredAt.toDate(),
      trace_id: record.traceId ?? null,
      correlation_id: record.correlationId ?? null,
      causation_id: record.causationId ?? null,
      partition_key: record.partitionKey ?? null,
      payload: record.payload,
      locked_at: record.lockedAt?.toDate() ?? null,
      locked_by: record.lockedBy ?? null,
      lock_expires_at: record.lockExpiresAt?.toDate() ?? null,
      publish_attempts: record.publishAttempts,
      next_attempt_at: record.nextAttemptAt?.toDate() ?? null,
      published_at: record.publishedAt?.toDate() ?? null,
      publish_ref: record.publishRef ?? null,
      last_error: record.lastError ?? null,
      last_error_at: record.lastErrorAt?.toDate() ?? null,
      created_at: record.createdAt.toDate(),
    };
  }

  toPublish({ events, ctx }: CreateOutboxEvent): NewOutboxEventRow[] {
    return events.map((event) => ({
      store_id: ctx.serialized?.actorStoreId ?? null,
      destination: 'bullmq',
      status: 'pending',
      event_type: event.eventType,
      schema_version: 1,
      aggregate_type: event.aggregateType,
      aggregate_id: event.aggregateId,
      occurred_at: event.occurredAt.toDate(),
      trace_id: ctx.traceId ?? null,
      correlation_id: ctx.serialized?.correlationId ?? null,
      causation_id: ctx.serialized?.causationId ?? ctx.spanId ?? null,
      partition_key:
        ctx.serialized?.correlationId ?? ctx.serialized?.actorStoreId ?? event.aggregateId,
      payload: {
        data: event.payload,
        _obs: ctx.serialized,
      } as unknown as JsonValue,
      publish_attempts: 0,
    }));
  }
}
