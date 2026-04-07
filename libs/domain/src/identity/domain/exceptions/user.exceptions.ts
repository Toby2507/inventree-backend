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

export class InvalidCredentialsException extends DomainException {
  readonly code = 'INVALID_CREDENTIALS';
  constructor() {
    super('Invalid email or password');
  }
}

export class EmailNotVerifiedException extends DomainException {
  readonly code = 'EMAIL_NOT_VERIFIED';
  constructor() {
    super('Email address has not been verified');
  }
}

export class EmailAlreadyVerifiedException extends DomainException {
  readonly code = 'EMAIL_ALREADY_VERIFIED';
  constructor() {
    super('Email address is already verified');
  }
}

export class MfaAlreadyEnabledException extends DomainException {
  readonly code = 'MFA_ALREADY_ENABLED';
  constructor() {
    super('MFA is already enabled for this account');
  }
}

export class MfaNotEnabledException extends DomainException {
  readonly code = 'MFA_NOT_ENABLED';
  constructor() {
    super('MFA is not enabled for this account');
  }
}
