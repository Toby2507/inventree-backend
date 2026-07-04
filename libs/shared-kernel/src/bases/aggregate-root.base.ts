import { DomainEvent } from './domain-event.base';
import { BaseEntity } from './entity.base';

export abstract class AggregateRoot<TSnapshot> extends BaseEntity<TSnapshot> {
  private readonly _domainEvents: DomainEvent[] = [];

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  pullDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents.length = 0;
    return events;
  }
}
