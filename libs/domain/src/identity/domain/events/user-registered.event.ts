import { DomainEvent } from '@app/common';

export interface UserRegisteredPayload {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  registeredAt: Date;
}

export class UserRegisteredEvent extends DomainEvent {
  readonly eventType = 'identity.user.registered';
  readonly aggregateType = 'user';

  constructor(public readonly payload: UserRegisteredPayload) {
    super(payload.userId);
  }
}
