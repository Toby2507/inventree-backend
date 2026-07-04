import { DomainEvent } from '@app/shared-kernel';

export interface AuthenticationBlockedPayload {
  userId: string;
  reason?: string;
}

export class AuthenticationBlockedEvent extends DomainEvent<AuthenticationBlockedPayload> {
  static readonly EVENT_TYPE = 'identity.user.authentication_blocked';

  readonly eventType = AuthenticationBlockedEvent.EVENT_TYPE;
  readonly aggregateType = 'user';

  constructor(public readonly payload: AuthenticationBlockedPayload) {
    super(payload.userId);
  }
}
