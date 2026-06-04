import { DomainException } from '@app/common/exceptions';

export class IdempotencyException extends DomainException {
  constructor(
    public readonly message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}
