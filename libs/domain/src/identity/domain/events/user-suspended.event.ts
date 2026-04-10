import { DomainEvent } from '@app/common';

export interface UserSuspendedPayload {
  userId: string;
  occuredAt: Date;
  reason?: string;
}

export class UserSuspendedEvent extends DomainEvent {
  readonly eventType = 'identity.user.suspended';
  readonly aggregateType = 'user';

  constructor(public readonly payload: UserSuspendedPayload) {
    super(payload.userId);
  }
}
