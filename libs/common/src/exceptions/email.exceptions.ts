import { DomainException } from './domain.exception';

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
