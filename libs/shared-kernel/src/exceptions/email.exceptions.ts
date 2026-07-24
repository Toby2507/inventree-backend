import { DomainException } from './exception.bases';
import { ExceptionCategory } from './exception.enum';

export class EmailCannotBeEmptyException extends DomainException {
  readonly code = 'EMPTY_EMAIL';
  constructor() {
    super('Email address cannot be empty');
  }

  override get category(): ExceptionCategory {
    return ExceptionCategory.VALIDATION;
  }
}

export class EmailInvalidException extends DomainException {
  readonly code = 'INVALID_EMAIL';
  constructor(email: string) {
    super(`Email address ${email} is invalid`);
  }

  override get category(): ExceptionCategory {
    return ExceptionCategory.VALIDATION;
  }
}

export class EmailMaxLengthExceededException extends DomainException {
  readonly code = 'EMAIL_MAX_LENGTH_EXCEEDED';
  constructor(maxLength: number) {
    super(`Email address cannot exceed ${maxLength} characters`);
  }

  override get category(): ExceptionCategory {
    return ExceptionCategory.VALIDATION;
  }
}
