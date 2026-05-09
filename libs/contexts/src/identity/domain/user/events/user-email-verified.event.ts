import { DomainEvent } from '@app/common';

export interface UserEmailVerifiedPayload {
  userId: string;
  email: string;
  verifiedAt: Date;
}

export class UserEmailVerifiedEvent extends DomainEvent<UserEmailVerifiedPayload> {
  static readonly EVENT_TYPE = 'identity.user.email_verified';

  readonly eventType = UserEmailVerifiedEvent.EVENT_TYPE;
  readonly aggregateType = 'user';

  constructor(public readonly payload: UserEmailVerifiedPayload) {
    super(payload.userId);
  }
}
