import { InvalidPhoneNumberException, PhoneNumberCannotBeEmptyException } from '../exceptions';

export class PhoneNumber {
  private static readonly NORMALIZATION_REGEX = /[\s\-\(\)]/g; // Remove spaces, dashes, parentheses
  private static readonly E164_REGEX = /^\+[1-9]\d{7,14}$/;

  private constructor(private readonly _value: string) {}

  static create(value: string): PhoneNumber {
    if (!value) throw new PhoneNumberCannotBeEmptyException();
    const normalized = PhoneNumber.normalize(value);
    PhoneNumber.validate(normalized);
    return new PhoneNumber(normalized);
  }

  static reconstitute(value: string): PhoneNumber {
    return new PhoneNumber(value);
  }

  private static normalize(value: string): string {
    return value.trim().replace(this.NORMALIZATION_REGEX, '');
  }

  private static validate(value: string): void {
    if (!this.E164_REGEX.test(value)) throw new InvalidPhoneNumberException(value);
  }

  get value(): string {
    return this._value;
  }

  equals(other?: PhoneNumber): boolean {
    return !!other && this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
