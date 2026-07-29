import { EXCEPTION_CATEGORIES, type ExceptionCategory } from '../../exceptions';
import { DomainException } from '../../exceptions/exception.bases';

export class InvalidDurationException extends DomainException {
  readonly code = 'DURATION_INVALID';
  constructor(part?: string) {
    super(`Duration ${part ? `for ${part}` : ''} must be a non-negative finite number`);
  }

  override get category(): ExceptionCategory {
    return EXCEPTION_CATEGORIES.VALIDATION;
  }
}

export class InvalidDurationPartException extends DomainException {
  readonly code = 'DURATION_PARTS_INVALID';
  constructor(unit: string) {
    super(
      `Duration part '${unit}' is invalid. Must be one of: weeks, days, hours, minutes, seconds, milliseconds`,
    );
  }

  override get category(): ExceptionCategory {
    return EXCEPTION_CATEGORIES.VALIDATION;
  }
}
