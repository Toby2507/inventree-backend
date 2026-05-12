import { DomainEvent } from '@app/common';

export interface UserLockedOutPayload {
  userId: string;
  lockoutUntil: Date;
  reason: string;
  failedAttempts: number;
}

export class UserLockedOutEvent extends DomainEvent<UserLockedOutPayload> {
  static readonly EVENT_TYPE = 'identity.user.locked_out';

  readonly eventType = UserLockedOutEvent.EVENT_TYPE;
  readonly aggregateType = 'user';

  constructor(public readonly payload: UserLockedOutPayload) {
    super(payload.userId);
  }
}
