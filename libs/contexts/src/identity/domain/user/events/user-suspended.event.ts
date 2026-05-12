import { DomainEvent } from '@app/common';

export interface UserSuspendedPayload {
  userId: string;
  reason?: string;
}

export class UserSuspendedEvent extends DomainEvent<UserSuspendedPayload> {
  static readonly EVENT_TYPE = 'identity.user.suspended';

  readonly eventType = UserSuspendedEvent.EVENT_TYPE;
  readonly aggregateType = 'user';

  constructor(public readonly payload: UserSuspendedPayload) {
    super(payload.userId);
  }
}
