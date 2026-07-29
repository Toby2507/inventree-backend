import { type Logger, LOGGER } from '@app/core/observability';
import { ObservedQueueWrapper } from '@app/core/observability/wrappers/bullmq-producer.wrapper';
import { getQueueToken } from '@nestjs/bullmq';
import { Inject, type Provider } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { QueueName } from './queue.constants';

export const OBSERVED_QUEUE = (name: QueueName) => `OBSERVED_QUEUE_${name}`;
export const InjectObservedQueue = (name: QueueName) => Inject(OBSERVED_QUEUE(name));
export type ObservedQueue<T extends Record<string, unknown>> = ObservedQueueWrapper<T>;

export function provideObservedQueue(name: QueueName): Provider {
  return {
    provide: OBSERVED_QUEUE(name),
    inject: [getQueueToken(name), LOGGER],
    useFactory: (queue: Queue, logger: Logger) => new ObservedQueueWrapper(queue, logger),
  };
}
