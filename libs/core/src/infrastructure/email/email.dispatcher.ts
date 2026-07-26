import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import type { EmailJob } from './email.interfaces';
import { EmailRegistry } from './email.registry';
import type { EmailDispatcher } from './ports/dispatcher.port';

@Injectable()
export class EmailDispatchService implements EmailDispatcher {
  constructor(private readonly registry: EmailRegistry) {}

  dispatch(job: Job): Promise<void> {
    const handler = this.registry.get(job.name as EmailJob);
    if (!handler) throw new Error(`No handler registered for ${job.name} in the email registry`);
    return handler.handle(job);
  }
}
