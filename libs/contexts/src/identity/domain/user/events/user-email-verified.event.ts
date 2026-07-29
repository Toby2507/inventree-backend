import { DomainEvent, Instant } from '@app/shared-kernel';

export interface UserEmailVerifiedPayload {
  userId: string;
  email: string;
  verifiedAt: Instant;
}

export class UserEmailVerifiedEvent extends DomainEvent {
  static readonly EVENT_TYPE = 'identity.user.email_verified';

  readonly eventType = UserEmailVerifiedEvent.EVENT_TYPE;
  readonly aggregateType = 'user';

  constructor(public readonly payload: UserEmailVerifiedPayload) {
    super(payload.userId);
  }
}
