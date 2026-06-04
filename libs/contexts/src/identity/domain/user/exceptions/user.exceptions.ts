import { DomainException } from '@app/common/exceptions';
import { UserStatus } from '../aggregates/user.aggregate';

export class UserCannotAuthenticateException extends DomainException {
  readonly code = 'UNAUTHENTICABLE_USER_FORBIDDEN';
  constructor() {
    super(
      'This account cannot be authenticated, likely due to pending verification or account lockout',
    );
  }
}

export class UserNotActiveException extends DomainException {
  readonly code = 'INACTIVE_USER_FORBIDDEN';
  constructor() {
    super('This account is not active or has been deleted');
  }
}

export class InvalidUserStatusTransitionException extends DomainException {
  readonly code = 'INVALID_USER_STATUS_TRANSITION';
  constructor(
    public readonly from: UserStatus,
    public readonly to: UserStatus,
  ) {
    super(`Invalid user status transition from "${from}" to "${to}"`);
  }
}

export class PasswordHashCannotBeEmptyException extends DomainException {
  readonly code = 'PASSWORD_HASH_INVALID';
  constructor() {
    super('Password hash cannot be empty');
  }
}

export class PasswordHashInvalidException extends DomainException {
  readonly code = 'PASSWORD_HASH_INVALID';
  constructor() {
    super('Value does not appear to be a valid password hash');
  }
}

export class PersonNameCannotBeEmptyException extends DomainException {
  readonly code = 'PERSON_NAME_INVALID';
  constructor() {
    super('Name cannot be empty');
  }
}

export class PersonNameMaxLengthExceededException extends DomainException {
  readonly code = 'PERSON_NAME_INVALID';
  constructor(max: number) {
    super(`Name must not exceed ${max} characters`);
  }
}

export class PersonNameInvalidException extends DomainException {
  readonly code = 'PERSON_NAME_INVALID';
  constructor(value: string) {
    super('Name contains invalid characters', { value });
  }
}
