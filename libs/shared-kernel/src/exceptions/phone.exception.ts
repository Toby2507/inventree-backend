import { DomainException } from './exception.bases';
import { ExceptionCategory } from './exception.enum';

export class InvalidPhoneNumberException extends DomainException {
  readonly code = 'PHONE_NUMBER_INVALID';
  constructor(value: string) {
    super(`Phone number ${value} is invalid`);
  }

  override get category(): ExceptionCategory {
    return ExceptionCategory.VALIDATION;
  }
}

export class PhoneNumberCannotBeEmptyException extends DomainException {
  readonly code = 'EMPTY_PHONE_NUMBER';
  constructor() {
    super('Phone number cannot be empty');
  }

  override get category(): ExceptionCategory {
    return ExceptionCategory.VALIDATION;
  }
}
