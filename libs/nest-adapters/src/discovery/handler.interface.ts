import { Job } from 'bullmq';

export interface JobHandler<T = string, P = unknown> {
  readonly job: T;

  handle(job: Job<P>): Promise<void>;
}
