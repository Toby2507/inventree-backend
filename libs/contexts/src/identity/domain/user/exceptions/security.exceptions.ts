import { DomainException } from '@app/common/exceptions';

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

export class PhoneNotProvidedException extends DomainException {
  readonly code = 'PHONE_NOT_PROVIDED';
  constructor() {
    super('No phone number provided for this account');
  }
}
