import { DomainEvent } from '@app/common/bases';
import { JsonValue } from '@app/common/types';
import { SerializedOutboxContext } from '@app/core/observability';
import { OperationalSchema } from '@app/database';
import { Insertable, Selectable } from 'kysely';

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
  occurredAt: Date;
  traceId?: string | null;
  correlationId?: string | null;
  causationId?: string | null;
  partitionKey?: string | null;
  payload: JsonValue;
  lockedAt?: Date | null;
  lockedBy?: string | null;
  lockExpiresAt?: Date | null;
  publishAttempts: number;
  nextAttemptAt?: Date | null;
  publishedAt?: Date | null;
  publishRef?: string | null;
  lastError?: string | null;
  lastErrorAt?: Date | null;
  createdAt: Date;
}

export interface CreateOutboxEvent {
  events: DomainEvent[];
  ctx: {
    serialized?: SerializedOutboxContext;
    traceId?: string;
    spanId?: string;
  };
}
