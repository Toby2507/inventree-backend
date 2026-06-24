import { QUEUE_NAMES } from '@app/core/infrastructure/queue';
import { EventRoute, EventRouterPort } from '@app/core/reliability/outbox';
import { Injectable } from '@nestjs/common';

@Injectable()
export class EventRouter implements EventRouterPort {
  private readonly routes: Record<string, EventRoute[]> = {
    'identity.user.registered': [{ queue: QUEUE_NAMES.NOTIFICATIONS }],
    'identity.user.email_verified': [{ queue: QUEUE_NAMES.NOTIFICATIONS }],
    'identity.user.locked_out': [{ queue: QUEUE_NAMES.NOTIFICATIONS }],
    'identity.user.disabled': [{ queue: QUEUE_NAMES.NOTIFICATIONS }],
  };

  resolve(eventType: string): EventRoute[] {
    return this.routes[eventType] ?? [];
  }
}
