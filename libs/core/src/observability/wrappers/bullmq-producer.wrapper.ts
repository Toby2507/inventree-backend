import { JobsOptions, Queue } from 'bullmq';
import {
  getOptionalObservationContext,
  serializeBusinessContext,
  SerializedBusinessContext,
} from '../context';
import { AppLoggerService } from '../logger';

export interface JobPayload<T = unknown> {
  data: T;
  _obs?: SerializedBusinessContext;
}

export class ObservedQueueWrapper<T = unknown> {
  private readonly logger;

  constructor(
    private readonly queue: Queue,
    logger: AppLoggerService,
  ) {
    this.logger = logger.forContext(`Queue.${queue.name}`);
  }

  async add(jobName: string, data: T, opts?: JobsOptions): Promise<void> {
    const ctx = getOptionalObservationContext();
    const payload: JobPayload<T> = {
      data,
      _obs: ctx ? serializeBusinessContext(ctx) : undefined,
    };

    await this.queue.add(jobName, payload, opts);
    this.logger.debug('Job enqueued', {
      queue: this.queue.name,
      jobName,
      correlationId: ctx?.correlationId,
    });
  }
}
