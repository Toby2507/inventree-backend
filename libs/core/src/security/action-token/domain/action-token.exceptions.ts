import { DomainException } from '@app/shared-kernel';

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

export class TokenExpiryBeforeCreationTimeException extends DomainException {
  readonly code = 'ACTION_TOKEN_INVALID';
  constructor() {
    super('The provided token expiry time is before the creation time');
  }
}
