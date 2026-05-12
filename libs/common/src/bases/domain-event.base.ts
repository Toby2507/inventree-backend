/**
 * Base class for all domain events.
 *
 * Subclasses declare:
 *   - `eventType`     — stable dot-separated string e.g. 'pos.transaction.completed'
 *   - `aggregateType` — table/aggregate name e.g. 'pos_transaction'
 *   - `payload`       — snapshot or relevant data (maps to outbox_events.payload)
 */
export abstract class DomainEvent<T = unknown> {
  readonly occurredAt: Date = new Date();

  abstract readonly eventType: string;
  abstract readonly aggregateType: string;
  abstract readonly payload: T;

  constructor(public readonly aggregateId: string) {}
}
