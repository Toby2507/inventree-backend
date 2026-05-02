import {
  PersonNameCannotBeEmptyException,
  PersonNameInvalidException,
  PersonNameMaxLengthExceededException,
} from '../exceptions';

export class PersonName {
  static readonly MAX_LENGTH = 100;
  // Rejects anything with ASCII control characters (0x00–0x1F, 0x7F)
  private static readonly CONTROL_CHAR_REGEX = /[\x00-\x1F\x7F]/;

  private constructor(private readonly _value: string) {}

  static create(raw: string): PersonName {
    const trimmed = raw.trim();
    PersonName.validate(trimmed);
    return new PersonName(trimmed);
  }

  static reconstitute(value: string): PersonName {
    return new PersonName(value);
  }

  private static validate(value: string): void {
    if (!value) throw new PersonNameCannotBeEmptyException();
    if (value.length > this.MAX_LENGTH)
      throw new PersonNameMaxLengthExceededException(this.MAX_LENGTH);
    if (this.CONTROL_CHAR_REGEX.test(value)) throw new PersonNameInvalidException(value);
  }

  get value(): string {
    return this._value;
  }

  equals(other?: PersonName): boolean {
    if (!other) return false;
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
