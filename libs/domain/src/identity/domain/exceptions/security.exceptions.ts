import { DomainException } from '@app/common';

export class InvalidCredentialsException extends DomainException {
  readonly code = 'INVALID_CREDENTIALS';
  constructor() {
    super('Invalid email or password');
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

export class MfaSecretRequiredException extends DomainException {
  readonly code = 'MFA_SECRET_REQUIRED';
  constructor() {
    super('MFA secret and kid is required for the selected MFA type');
  }
}

export class MfaSetupNotInProgressException extends DomainException {
  readonly code = 'MFA_SETUP_NOT_IN_PROGRESS';
  constructor() {
    super('No MFA setup is currently in progress for this account');
  }
}

export class MfaSetupInProgressException extends DomainException {
  readonly code = 'MFA_SETUP_IN_PROGRESS';
  constructor() {
    super('An MFA setup is already in progress for this account');
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

export class PhoneAlreadyVerifiedException extends DomainException {
  readonly code = 'PHONE_ALREADY_VERIFIED';
  constructor() {
    super('Phone number is already verified');
  }
}

export class PhoneNotProvidedException extends DomainException {
  readonly code = 'PHONE_NOT_PROVIDED';
  constructor() {
    super('No phone number provided for this account');
  }
}
