import type { SerializedOutboxContext } from '@app/core/observability';
import type { OperationalSchema } from '@app/database';
import type { DomainEvent, Instant, JsonValue } from '@app/shared-kernel';
import type { Insertable, Selectable } from 'kysely';

export type OutboxEventRow = Omit<Selectable<OperationalSchema['outbox_events']>, 'updated_at'>;
export type NewOutboxEventRow = Insertable<OperationalSchema['outbox_events']>;
export type OutboxEventStatus = OutboxEventRow['status'];
export type OutboxEventDestination = OutboxEventRow['destination'];

export interface OutboxEvent {
  id: string;
  storeId?: string | null;
  destination: OutboxEventDestination;
  status: OutboxEventStatus;
  eventType: string;
  schemaVersion: number;
  aggregateType?: string | null;
  aggregateId?: string | null;
  occurredAt: Instant;
  traceId?: string | null;
  correlationId?: string | null;
  causationId?: string | null;
  partitionKey?: string | null;
  payload: JsonValue;
  lockedAt?: Instant | null;
  lockedBy?: string | null;
  lockExpiresAt?: Instant | null;
  publishAttempts: number;
  nextAttemptAt?: Instant | null;
  publishedAt?: Instant | null;
  publishRef?: string | null;
  lastError?: string | null;
  lastErrorAt?: Instant | null;
  createdAt: Instant;
}

export interface CreateOutboxEvent {
  events: DomainEvent[];
  ctx: {
    serialized?: SerializedOutboxContext;
    traceId?: string;
    spanId?: string;
  };
}
