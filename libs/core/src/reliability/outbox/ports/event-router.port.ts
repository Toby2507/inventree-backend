import type { QueueName } from '@app/core/infrastructure/queue';

export interface EventRoute {
  queue: QueueName;
  jobName?: string;
}

export interface EventRouter {
  resolve(eventType: string): EventRoute[];
}

export const EVENT_ROUTER = Symbol('EVENT_ROUTER');
