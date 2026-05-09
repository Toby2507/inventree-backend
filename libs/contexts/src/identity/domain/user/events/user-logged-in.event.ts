import { DomainEvent } from '@app/common';

export interface UserLoggedInPayload {
  userId: string;
}

export class UserLoggedInEvent extends DomainEvent<UserLoggedInPayload> {
  static readonly EVENT_TYPE = 'identity.user.logged_in';

  readonly eventType = UserLoggedInEvent.EVENT_TYPE;
  readonly aggregateType = 'user';

  constructor(public readonly payload: UserLoggedInPayload) {
    super(payload.userId);
  }
}
