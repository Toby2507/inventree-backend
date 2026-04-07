import { DomainException } from '@app/common';

export class EmailCannotBeEmptyException extends DomainException {
  readonly code = 'EMAIL_INVALID';
  constructor() {
    super('Email address cannot be empty');
  }
}

export class EmailInvalidException extends DomainException {
  readonly code = 'EMAIL_INVALID';
  constructor(email: string) {
    super(`Email address ${email} is invalid`);
  }
}

export class EmailMaxLengthExceededException extends DomainException {
  readonly code = 'EMAIL_INVALID';
  constructor(maxLength: number) {
    super(`Email address cannot exceed ${maxLength} characters`);
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
