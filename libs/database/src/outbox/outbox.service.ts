import { DomainEvent } from '@app/common/bases';
import { getOptionalObservationContext, serializeOutboxContext } from '@app/core/observability';
import { trace } from '@opentelemetry/api';
import { OperationalDB } from '../types/db.schema.types';

// interface OutboxEventInsert {
//   event_type: string;
//   aggregate_type?: string;
//   aggregate_id?: string;
//   payload: Record<string, unknown>; // business payload
//   // These are stored as top-level columns, not inside payload:
//   trace_id?: string;
//   correlation_id?: string; // stored via partition_key convention too
//   causation_id?: string;
//   occurred_at: Date;
// }

export class OutboxService {
  async publishAll(events: DomainEvent[], db: OperationalDB): Promise<void> {
    if (!events.length) return;
    const ctx = getOptionalObservationContext();
    const serializedObs = ctx ? serializeOutboxContext(ctx) : null;
    const activeSpan = trace.getActiveSpan();

    const rows = events.map((event) => ({
      event_type: event.eventType,
      aggregate_type: event.aggregateType,
      aggregate_id: event.aggregateId,
      schema_version: 1,
      occurred_at: event.occurredAt,
      payload: {
        ...event.payload,
        _obs: serializedObs,
      },
      // Also populate the top-level columns for direct SQL querying / alerting
      store_id: ctx?.actor?.storeId ?? null,
      partition_key: ctx?.correlationId ?? event.aggregateId,
      correlation_id: serializedObs?.correlationId ?? null,
      causation_id: serializedObs?.causationId ?? activeSpan?.spanContext().spanId ?? null,
      next_attempt_at: new Date(),
    }));
    console.log(db, rows);

    // await db.insertInto('outbox_events').values(rows).execute();
  }
}
