import { DomainEvent } from '@app/common';

export interface UserLoggedInPayload {
  userId: string;
}

export class UserLoggedInEvent extends DomainEvent {
  readonly eventType = 'identity.user.logged_in';
  readonly aggregateType = 'user';

  constructor(public readonly payload: UserLoggedInPayload) {
    super(payload.userId);
  }
}
