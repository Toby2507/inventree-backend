import { DomainException } from './exception.bases';
import { EXCEPTION_CATEGORIES, type ExceptionCategory } from './exception.enum';

export class InvalidUUIDException extends DomainException {
  readonly code = 'INVALID_UUID';
  constructor() {
    super('Provided id values must be valid UUIDs');
  }

  override get category(): ExceptionCategory {
    return EXCEPTION_CATEGORIES.VALIDATION;
  }
}

export class UUIDCannotBeEmptyException extends DomainException {
  readonly code = 'EMPTY_UUID';
  constructor() {
    super('Provided id values cannot be empty');
  }

  override get category(): ExceptionCategory {
    return EXCEPTION_CATEGORIES.VALIDATION;
  }
}
