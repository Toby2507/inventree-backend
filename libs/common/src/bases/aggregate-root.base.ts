import { BaseDomainEvent } from './domain-event.base';
import { BaseEntity } from './entity.base';

/**
 * Abstract base for aggregate roots.
 *
 * Only aggregate roots are permitted to raise domain events. Non-root entities
 * (e.g. TransactionLine inside Transaction) must delegate state changes up to
 * their root, which then decides whether an event should be raised.
 *
 * This enforces the DDD rule that the aggregate root is the sole entry point
 * for all mutations within its consistency boundary.
 *
 * ---
 * ## Domain Events & the Outbox Pattern
 *
 * Domain events represent facts that happened inside the domain — things other
 * parts of the system may need to react to. Examples:
 *   - A POS transaction was completed  → inventory must be decremented
 *   - A store member was invited       → an email must be sent
 *   - A purchase order was approved    → a notification must be raised
 *
 * ### How it works
 *
 * 1. A business method on the aggregate root raises an event via
 *    `this.addDomainEvent()`. The event is queued in memory on the root.
 *
 *    ```typescript
 *    complete(): void {
 *      if (this._status !== 'open') throw new TransactionAlreadyCompletedException();
 *      this._status = 'completed';
 *      this.addDomainEvent(new TransactionCompletedEvent(this.toSnapshot()));
 *    }
 *    ```
 *
 * 2. The command handler saves the aggregate then pulls its events:
 *
 *    ```typescript
 *    async execute(command: CompleteTransactionCommand): Promise<void> {
 *      const transaction = await this.repo.findById(command.props.transactionId);
 *      transaction.complete();
 *      await this.repo.save(transaction);
 *      const events = transaction.pullDomainEvents();
 *      await this.outbox.publishAll(events);
 *    }
 *    ```
 *
 * 3. `OutboxService.publishAll()` writes all events to `operational.outbox_events`
 *    IN THE SAME DATABASE TRANSACTION as `repo.save()`. This is the outbox
 *    guarantee — the state change and the intent to publish are atomic. If the
 *    process crashes after the commit, the outbox processor picks up the pending
 *    events on its next poll and publishes them to BullMQ.
 *
 * 4. `pullDomainEvents()` drains the internal array. After this call the root
 *    holds no events. This prevents double-publishing if the aggregate is
 *    referenced again in the same request.
 *
 * ### Why events live on the aggregate root (not returned from the method)
 *
 * A root method may raise multiple events across nested calls. Collecting them
 * on the root gives the command handler a single predictable place to retrieve
 * them — regardless of how many methods were called or how deeply business
 * logic is nested.
 *
 * ### What a domain event looks like
 *
 * ```typescript
 * export class TransactionCompletedEvent extends BaseDomainEvent {
 *   readonly eventType = 'pos.transaction.completed';
 *   readonly aggregateType = 'pos_transaction';
 *
 *   constructor(public readonly payload: TransactionSnapshot) {
 *     super(payload.id);
 *   }
 * }
 * ```
 */
export abstract class AggregateRoot<TSnapshot> extends BaseEntity<TSnapshot> {
  private readonly _domainEvents: BaseDomainEvent[] = [];

  protected addDomainEvent(event: BaseDomainEvent): void {
    this._domainEvents.push(event);
  }

  pullDomainEvents(): BaseDomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents.length = 0;
    return events;
  }
}
