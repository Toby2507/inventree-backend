import type { QueueName } from '@app/core/infrastructure/queue';
import type { Queue } from 'bullmq';

export interface QueueMapper {
  get(queueName: QueueName): Queue;
}

export const QUEUE_MAPPER = Symbol('QUEUE_MAPPER');
