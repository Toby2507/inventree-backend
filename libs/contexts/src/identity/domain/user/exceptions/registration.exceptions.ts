import { DomainException } from '@app/common';

export class UserEmailAlreadyExistsException extends DomainException {
  readonly code = 'USER_EMAIL_ALREADY_EXISTS';
  constructor(email: string) {
    super(`A user with email address ${email} already exists`);
  }
}
