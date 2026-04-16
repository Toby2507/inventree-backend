import { DomainEvent } from '@app/common';

export interface UserEmailVerifiedPayload {
  userId: string;
  email: string;
  verifiedAt: Date;
}

export class UserEmailVerifiedEvent extends DomainEvent {
  readonly eventType = 'identity.user.email_verified';
  readonly aggregateType = 'user';

  constructor(public readonly payload: UserEmailVerifiedPayload) {
    super(payload.userId);
  }
}
