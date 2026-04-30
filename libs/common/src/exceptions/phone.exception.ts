import { DomainException } from './domain.exception';

export class InvalidPhoneNumberException extends DomainException {
  readonly code = 'PHONE_NUMBER_INVALID';
  constructor(value: string) {
    super(`Phone number ${value} is invalid`);
  }
}

export class PhoneNumberCannotBeEmptyException extends DomainException {
  readonly code = 'PHONE_NUMBER_INVALID';
  constructor() {
    super('Phone number cannot be empty');
  }
}
