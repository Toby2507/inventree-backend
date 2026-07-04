export abstract class DomainEvent<T = object> {
  readonly occurredAt: Date = new Date();

  abstract readonly eventType: string;
  abstract readonly aggregateType: string;
  abstract readonly payload: T;

  constructor(public readonly aggregateId: string) {}
}
