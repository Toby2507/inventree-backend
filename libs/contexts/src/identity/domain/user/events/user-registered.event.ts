import { DomainEvent } from '@app/common';

export interface UserRegisteredPayload {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  registeredAt: Date;
}

export class UserRegisteredEvent extends DomainEvent<UserRegisteredPayload> {
  static readonly EVENT_TYPE = 'identity.user.registered';

  readonly eventType = UserRegisteredEvent.EVENT_TYPE;
  readonly aggregateType = 'user';

  constructor(public readonly payload: UserRegisteredPayload) {
    super(payload.userId);
  }
}
