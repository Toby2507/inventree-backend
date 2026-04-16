import { DomainEvent } from '@app/common';

export interface UserEnabledPayload {
  userId: string;
  occuredAt: Date;
  reason?: string;
}

export class UserEnabledEvent extends DomainEvent {
  readonly eventType = 'identity.user.enabled';
  readonly aggregateType = 'user';

  constructor(public readonly payload: UserEnabledPayload) {
    super(payload.userId);
  }
}
