import { Instant } from '../time/value-objects/instant.vo';

export abstract class DomainEvent<T = any> {
  readonly occurredAt: Instant = Instant.fromDate(new Date());

  abstract readonly eventType: string;
  abstract readonly aggregateType: string;
  abstract readonly payload: T;

  constructor(public readonly aggregateId: string) {}
}
