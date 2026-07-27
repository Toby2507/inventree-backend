import { DomainEvent, Instant } from '@app/shared-kernel';

export interface UserLockedOutPayload {
  userId: string;
  lockoutUntil: Instant;
  reason: string;
  failedAttempts: number;
}

export class UserLockedOutEvent extends DomainEvent {
  static readonly EVENT_TYPE = 'identity.user.locked_out';

  readonly eventType = UserLockedOutEvent.EVENT_TYPE;
  readonly aggregateType = 'user';

  constructor(public readonly payload: UserLockedOutPayload) {
    super(payload.userId);
  }
}
