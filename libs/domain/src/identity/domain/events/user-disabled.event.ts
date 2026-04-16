import { DomainEvent } from '@app/common';

export interface UserDisabledPayload {
  userId: string;
  occuredAt: Date;
  reason?: string;
}

export class UserDisabledEvent extends DomainEvent {
  readonly eventType = 'identity.user.disabled';
  readonly aggregateType = 'user';

  constructor(public readonly payload: UserDisabledPayload) {
    super(payload.userId);
  }
}
