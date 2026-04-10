import { DomainEvent } from '@app/common';

export interface UserLockedOutPayload {
  userId: string;
  occurredAt: Date;
  lockoutUntil: Date;
  reason: string;
  failedAttempts: number;
}

export class UserLockedOutEvent extends DomainEvent {
  readonly eventType = 'identity.user.locked_out';
  readonly aggregateType = 'user';

  constructor(public readonly payload: UserLockedOutPayload) {
    super(payload.userId);
  }
}
