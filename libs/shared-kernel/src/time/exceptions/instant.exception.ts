import { DomainException, EXCEPTION_CATEGORIES, type ExceptionCategory } from '../../exceptions';

export class InvalidInstantException extends DomainException {
  readonly code = 'INSTANT_INVALID';
  constructor(input: unknown, cause?: unknown) {
    super(`Valid Instant could not be created from input: ${JSON.stringify(input)}`, { cause });
  }

  override get category(): ExceptionCategory {
    return EXCEPTION_CATEGORIES.VALIDATION;
  }
}
