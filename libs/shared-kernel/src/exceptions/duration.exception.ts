import { DomainException } from './domain.exception';

export class InvalidDurationException extends DomainException {
  readonly code = 'DURATION_INVALID';
  constructor(part?: string) {
    super(`Duration ${part ? `for ${part}` : ''} must be a non-negative finite number`);
  }
}

export class InvalidDurationPartException extends DomainException {
  readonly code = 'DURATION_PARTS_INVALID';
  constructor(unit: string) {
    super(
      `Duration part '${unit}' is invalid. Must be one of: weeks, days, hours, minutes, seconds, milliseconds`,
    );
  }
}
