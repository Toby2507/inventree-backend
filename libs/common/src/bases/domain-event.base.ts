/**
 * Base class for all domain events.
 *
 * Subclasses declare:
 *   - `eventType`     — stable dot-separated string e.g. 'pos.transaction.completed'
 *   - `aggregateType` — table/aggregate name e.g. 'pos_transaction'
 *   - `payload`       — snapshot or relevant data (maps to outbox_events.payload)
 */
export abstract class BaseDomainEvent {
  readonly occurredAt: Date = new Date();
  abstract readonly eventType: string;
  abstract readonly aggregateType: string;

  constructor(public readonly aggregateId: string) {}
}
