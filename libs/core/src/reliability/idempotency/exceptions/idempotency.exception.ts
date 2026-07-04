import { DomainException } from '@app/shared-kernel';

export class IdempotencyException extends DomainException {
  constructor(
    public readonly message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}
