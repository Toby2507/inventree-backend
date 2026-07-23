import { EmailDispatcher } from '@app/core/infrastructure/email';
import { QUEUE_NAMES } from '@app/core/infrastructure/queue';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor(QUEUE_NAMES.EMAIL)
export class EmailProcessor extends WorkerHost {
  constructor(private readonly dispatcher: EmailDispatcher) {
    super();
  }

  async process(job: Job): Promise<void> {
    await this.dispatcher.dispatch(job);
  }
}
