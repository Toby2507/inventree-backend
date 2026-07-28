import type { ObservedQueue, QueueName } from '@app/core/infrastructure/queue';

export interface QueueMapper {
  get(queueName: QueueName): ObservedQueue<Record<string, unknown>>;
}

export const QUEUE_MAPPER = Symbol('QUEUE_MAPPER');
