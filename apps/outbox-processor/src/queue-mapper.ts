import { QUEUE_NAMES, QueueName } from '@app/core/infrastructure/queue';
import { QueueMapperPort } from '@app/core/reliability/outbox';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class QueueMapper implements QueueMapperPort {
  private readonly queues: Map<QueueName, Queue>;

  constructor(
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) notifications: Queue,
    @InjectQueue(QUEUE_NAMES.INVENTORY) inventory: Queue,
    @InjectQueue(QUEUE_NAMES.ANALYTICS) analytics: Queue,
    @InjectQueue(QUEUE_NAMES.BILLING) billing: Queue,
    @InjectQueue(QUEUE_NAMES.REPORTS) reports: Queue,
  ) {
    this.queues = new Map<QueueName, Queue>([
      [QUEUE_NAMES.NOTIFICATIONS, notifications],
      [QUEUE_NAMES.INVENTORY, inventory],
      [QUEUE_NAMES.ANALYTICS, analytics],
      [QUEUE_NAMES.BILLING, billing],
      [QUEUE_NAMES.REPORTS, reports],
    ]);
  }

  get(queueName: QueueName): Queue {
    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`No queue registered for name: ${queueName}`);
    return queue;
  }
}
