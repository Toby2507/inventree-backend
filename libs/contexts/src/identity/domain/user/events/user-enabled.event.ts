import { DomainEvent } from '@app/common';

export interface UserEnabledPayload {
  userId: string;
  reason?: string;
}

export class UserEnabledEvent extends DomainEvent<UserEnabledPayload> {
  static readonly EVENT_TYPE = 'identity.user.enabled';

  readonly eventType = UserEnabledEvent.EVENT_TYPE;
  readonly aggregateType = 'user';

  constructor(public readonly payload: UserEnabledPayload) {
    super(payload.userId);
  }
}
