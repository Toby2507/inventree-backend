import { ExceptionCategory, InfrastructureException } from '@app/shared-kernel';

export class IdempotencyException extends InfrastructureException {
  constructor(
    public readonly message: string,
    public readonly code: string,
    private readonly _category: ExceptionCategory,
  ) {
    super(message);
  }

  override get category(): ExceptionCategory {
    return this._category ?? ExceptionCategory.INTERNAL;
  }
}
