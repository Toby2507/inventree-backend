import { DomainException } from '@app/common';

export class UserAlreadyExistsException extends DomainException {
  readonly code = 'USER_ALREADY_EXISTS';
  constructor(email: string) {
    super(`A user with email ${email} already exists`);
  }
}

export class UserNotFoundException extends DomainException {
  readonly code = 'USER_NOT_FOUND';
  constructor() {
    super('User not found');
  }
}

export class UserDisabledException extends DomainException {
  readonly code = 'USER_DISABLED';
  constructor() {
    super('This account has been disabled');
  }
}

export class UserAccountLockedException extends DomainException {
  readonly code = 'USER_ACCOUNT_LOCKED';
  constructor(until: Date) {
    super(`Account is locked until ${until.toISOString()}`);
  }
}

export class UserPendingException extends DomainException {
  readonly code = 'USER_PENDING';
  constructor() {
    super(
      'This account is pending verification, please check your email for verification instructions',
    );
  }
}
