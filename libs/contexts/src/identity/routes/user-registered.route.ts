import { EMAIL_JOBS, type VerificationEmailJob } from '@app/core/infrastructure/email';
import { QUEUE_NAMES } from '@app/core/infrastructure/queue';
import type { EventRouteDefinition } from '@app/core/reliability/outbox';
import { UserRegisteredEvent } from '../domain/user/events/user-registered.event';

const verificationEmailRoute = {
  eventType: UserRegisteredEvent.EVENT_TYPE,
  queue: QUEUE_NAMES.EMAIL,
  jobName: EMAIL_JOBS.SEND_VERIFICATION_EMAIL,
  toPayload: (payload) => ({
    firstName: payload.firstName ?? 'there',
    email: payload.email,
    userId: payload.userId,
  }),
} satisfies EventRouteDefinition<UserRegisteredEvent, VerificationEmailJob>;

export const USER_REGISTERED_ROUTES: EventRouteDefinition[] = [verificationEmailRoute];
