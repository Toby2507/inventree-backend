import { DomainException } from './domain.exception';

export class InvalidUUIDException extends DomainException {
  readonly code = 'INVALID_UUID';
  constructor() {
    super('Provided id values must be valid UUIDs');
  }
}

export class UUIDCannotBeEmptyException extends DomainException {
  readonly code = 'INVALID_UUID';
  constructor() {
    super('Provided id values cannot be empty');
  }
}
