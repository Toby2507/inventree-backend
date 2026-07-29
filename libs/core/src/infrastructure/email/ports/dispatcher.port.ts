import type { Job } from 'bullmq';

export interface EmailDispatcher {
  dispatch(job: Job): Promise<void>;
}

export const EMAIL_DISPATCHER = Symbol('EMAIL_DISPATCHER');
