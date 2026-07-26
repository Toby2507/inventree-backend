import type { JobHandler } from '@app/framework/nest/discovery';

export const EMAIL_JOBS = {
  SEND_VERIFICATION_EMAIL: 'send.verification.email',
} as const;
export type EmailJob = (typeof EMAIL_JOBS)[keyof typeof EMAIL_JOBS];

export type EmailJobHandler<T = unknown> = JobHandler<EmailJob, T>;

export const EMAIL_JOB_HANDLER = Symbol('EMAIL_JOB_HANDLER');
