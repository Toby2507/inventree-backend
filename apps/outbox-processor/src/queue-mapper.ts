import type { EmailJobDataMap } from '@app/core/infrastructure/email';
import {
  InjectObservedQueue,
  type ObservedQueue,
  QUEUE_NAMES,
  type QueueName,
} from '@app/core/infrastructure/queue';
import type { QueueMapper } from '@app/core/reliability/outbox';
import { Injectable } from '@nestjs/common';

type QueueDataMap = {
  [QUEUE_NAMES.EMAIL]: EmailJobDataMap;
};

@Injectable()
export class QueueMappingService implements QueueMapper {
  private readonly queues: Map<QueueName, ObservedQueue<any>>;

  constructor(@InjectObservedQueue(QUEUE_NAMES.EMAIL) email: ObservedQueue<EmailJobDataMap>) {
    this.queues = new Map([[QUEUE_NAMES.EMAIL, email]]);
  }

  get<K extends QueueName>(queueName: K): ObservedQueue<QueueDataMap[K]> {
    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`No queue registered for name: ${queueName}`);
    return queue;
  }
}
