import {
  EmailCannotBeEmptyException,
  EmailInvalidException,
  EmailMaxLengthExceededException,
} from '../exceptions';

export class Email {
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private static readonly MAX_LENGTH = 255;

  private constructor(private readonly _value: string) {}

  static create(raw: string): Email {
    const email = raw.toLowerCase().trim();
    Email.validate(email);
    return new Email(email);
  }

  static reconstitute(value: string): Email {
    return new Email(value);
  }

  private static validate(value: string): void {
    if (!value) throw new EmailCannotBeEmptyException();
    if (value.length > this.MAX_LENGTH) throw new EmailMaxLengthExceededException(this.MAX_LENGTH);
    if (!this.EMAIL_REGEX.test(value)) throw new EmailInvalidException(value);
  }

  get value(): string {
    return this._value;
  }

  equals(other?: Email): boolean {
    if (!other) return false;
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
