export abstract class DomainException extends Error {
  abstract readonly code: string;
  readonly context?: Record<string, any>;

  constructor(message: string, context?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    this.context = context;

    // Maintains proper prototype chain for `instanceof` checks when compiled to ES5 or CommonJS targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
