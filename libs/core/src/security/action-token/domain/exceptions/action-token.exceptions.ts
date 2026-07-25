import { DomainException, EXCEPTION_CATEGORIES, type ExceptionCategory } from '@app/shared-kernel';

// Business Rule Exceptions
export class TokenAlreadyConsumedException extends DomainException {
  readonly code = 'ACTION_TOKEN_INVALID';
  constructor() {
    super('The provided token has already been consumed');
  }
}

export class TokenRevokedException extends DomainException {
  readonly code = 'ACTION_TOKEN_INVALID';
  constructor() {
    super('The provided token has been revoked');
  }
}

export class TokenExpiredException extends DomainException {
  readonly code = 'ACTION_TOKEN_INVALID';
  constructor() {
    super('The provided token has expired');
  }
}

// Validation exceptions
export class TokenExpiryBeforeCreationTimeException extends DomainException {
  readonly code = 'EXPIRY_BEFORE_CREATION_TIME';
  constructor() {
    super('The provided token expiry time is before the creation time');
  }

  override get category(): ExceptionCategory {
    return EXCEPTION_CATEGORIES.VALIDATION;
  }
}
