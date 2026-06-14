import { Queue } from 'bullmq';

export interface QueueMapperPort {
  get(queueName: string): Queue;
}

export const QUEUE_MAPPER = Symbol('QUEUE_MAPPER');
