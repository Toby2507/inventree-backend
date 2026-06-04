import {
  PasswordHashCannotBeEmptyException,
  PasswordHashInvalidException,
} from '../exceptions/user.exceptions';

export class PasswordHash {
  // Guards against accidentally passing a plaintext password or an empty string.
  private static readonly MIN_LENGTH = 20;

  private constructor(private readonly _value: string) {}

  static create(raw: string): PasswordHash {
    const hash = raw.trim();
    PasswordHash.validate(hash);
    return new PasswordHash(hash);
  }

  static reconstitute(value: string): PasswordHash {
    return new PasswordHash(value);
  }

  private static validate(value: string): void {
    if (!value) throw new PasswordHashCannotBeEmptyException();
    if (value.length < PasswordHash.MIN_LENGTH) throw new PasswordHashInvalidException();
  }

  get value(): string {
    return this._value;
  }

  toString(): string {
    return '[PasswordHash]'; // Prevents accidental logging of hash value
  }
}
