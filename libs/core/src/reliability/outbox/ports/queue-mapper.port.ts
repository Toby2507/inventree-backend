import { QueueName } from '@app/core/infrastructure/queue';
import { Queue } from 'bullmq';

export interface QueueMapperPort {
  get(queueName: QueueName): Queue;
}

export const QUEUE_MAPPER = Symbol('QUEUE_MAPPER');
