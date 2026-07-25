import { EMAIL_JOBS } from '@app/core/infrastructure/email/email.interfaces';
import { QUEUE_NAMES } from '@app/core/infrastructure/queue';
import { EventRoute, type EventRouter } from '@app/core/reliability/outbox';
import { Injectable } from '@nestjs/common';

@Injectable()
export class EventRoutingService implements EventRouter {
  private readonly routes: Record<string, EventRoute[]> = {
    'identity.user.registered': [
      { queue: QUEUE_NAMES.EMAIL, jobName: EMAIL_JOBS.SEND_VERIFICATION_EMAIL },
    ],
    'identity.user.email_verified': [{ queue: QUEUE_NAMES.NOTIFICATIONS }],
    'identity.user.locked_out': [{ queue: QUEUE_NAMES.NOTIFICATIONS }],
    'identity.user.disabled': [{ queue: QUEUE_NAMES.NOTIFICATIONS }],
  };

  resolve(eventType: string): EventRoute[] {
    return this.routes[eventType] ?? [];
  }
}
