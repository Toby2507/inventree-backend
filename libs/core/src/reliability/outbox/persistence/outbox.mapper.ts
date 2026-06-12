import { Mapper } from '@app/common/bases';
import { JsonValue } from '@app/common/types';
import {
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
      occurredAt: row.occurred_at!,
      traceId: row.trace_id,
      correlationId: row.correlation_id,
      causationId: row.causation_id,
      partitionKey: row.partition_key,
      payload: row.payload,
      lockedAt: row.locked_at,
      lockedBy: row.locked_by,
      lockExpiresAt: row.lock_expires_at,
      publishAttempts: row.publish_attempts!,
      nextAttemptAt: row.next_attempt_at,
      publishedAt: row.published_at,
      publishRef: row.publish_ref,
      lastError: row.last_error,
      lastErrorAt: row.last_error_at,
      createdAt: row.created_at!,
    };
  }

  toPersistence(record: OutboxEvent): OutboxEventRow {
    return {
      id: record.id,
      store_id: record.storeId!,
      destination: record.destination,
      status: record.status,
      event_type: record.eventType,
      schema_version: record.schemaVersion,
      aggregate_type: record.aggregateType!,
      aggregate_id: record.aggregateId!,
      occurred_at: record.occurredAt,
      trace_id: record.traceId!,
      correlation_id: record.correlationId!,
      causation_id: record.causationId!,
      partition_key: record.partitionKey!,
      payload: record.payload,
      locked_at: record.lockedAt!,
      locked_by: record.lockedBy!,
      lock_expires_at: record.lockExpiresAt!,
      publish_attempts: record.publishAttempts,
      next_attempt_at: record.nextAttemptAt!,
      published_at: record.publishedAt!,
      publish_ref: record.publishRef!,
      last_error: record.lastError!,
      last_error_at: record.lastErrorAt!,
      created_at: record.createdAt,
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
      occurred_at: event.occurredAt,
      trace_id: ctx.traceId,
      correlation_id: ctx.serialized?.correlationId ?? null,
      causation_id: ctx.serialized?.causationId ?? ctx.spanId ?? null,
      partition_key:
        ctx.serialized?.correlationId ?? ctx.serialized?.actorStoreId ?? event.aggregateId,
      payload: {
        ...event.payload,
        _obs: ctx.serialized,
      } as unknown as JsonValue,
      publish_attempts: 0,
    }));
  }
}
