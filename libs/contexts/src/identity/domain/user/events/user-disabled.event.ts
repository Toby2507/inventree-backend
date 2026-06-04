import { DomainEvent } from '@app/common/bases';

export interface UserDisabledPayload {
  userId: string;
  reason?: string;
}

export class UserDisabledEvent extends DomainEvent<UserDisabledPayload> {
  static readonly EVENT_TYPE = 'identity.user.disabled';

  readonly eventType = UserDisabledEvent.EVENT_TYPE;
  readonly aggregateType = 'user';

  constructor(public readonly payload: UserDisabledPayload) {
    super(payload.userId);
  }
}
