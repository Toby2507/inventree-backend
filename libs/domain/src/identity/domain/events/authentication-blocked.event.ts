import { DomainEvent } from '@app/common';

export interface AuthenticationBlockedPayload {
  userId: string;
  reason?: string;
}

export class AuthenticationBlockedEvent extends DomainEvent {
  readonly eventType = 'identity.user.authentication_blocked';
  readonly aggregateType = 'user';

  constructor(public readonly payload: AuthenticationBlockedPayload) {
    super(payload.userId);
  }
}
