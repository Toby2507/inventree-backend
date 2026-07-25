import {
  ApplicationException,
  EXCEPTION_CATEGORIES,
  type ExceptionCategory,
} from '@app/shared-kernel';

export class TokenNotFoundException extends ApplicationException {
  readonly code = 'ACTION_TOKEN_NOT_FOUND';
  constructor() {
    super('The provided token was not found');
  }

  override get category(): ExceptionCategory {
    return EXCEPTION_CATEGORIES.NOT_FOUND;
  }
}
