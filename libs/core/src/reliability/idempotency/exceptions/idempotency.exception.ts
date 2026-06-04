import { DomainException } from '@app/common';

export class IdempotencyException extends DomainException {
  constructor(
    public readonly message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}
