import type { QueueName } from '@app/core/infrastructure/queue';
import type { DomainEvent } from '@app/shared-kernel';

export interface EventRoute<
  TEvent extends DomainEvent = DomainEvent,
  TOutput = Record<string, unknown>,
> {
  queue: QueueName;
  jobName?: string;
  toPayload?: (payload: TEvent['payload']) => TOutput;
}

export interface EventRouteDefinition<
  TEvent extends DomainEvent = DomainEvent,
  TOutput = Record<string, unknown>,
> extends EventRoute<TEvent, TOutput> {
  eventType: string;
}

export interface EventRouter {
  resolve(eventType: string): EventRoute[];
}

export const EVENT_ROUTER = Symbol('EVENT_ROUTER');
