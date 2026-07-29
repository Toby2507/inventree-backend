import { EXCEPTION_CATEGORIES, type ExceptionCategory } from './exception.enum';

abstract class ExceptionBase extends Error {
  abstract readonly code: string;
  readonly context?: Record<string, any>;

  constructor(message: string, context?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    this.context = context;

    // Maintains proper prototype chain for `instanceof` checks when compiled to ES5 or CommonJS targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }

  abstract get category(): ExceptionCategory;
}

export abstract class DomainException extends ExceptionBase {
  get category(): ExceptionCategory {
    return EXCEPTION_CATEGORIES.BUSINESS_RULE;
  }
}

export abstract class ApplicationException extends ExceptionBase {}

export abstract class InfrastructureException extends ExceptionBase {
  get category(): ExceptionCategory {
    return EXCEPTION_CATEGORIES.INTERNAL;
  }
}
