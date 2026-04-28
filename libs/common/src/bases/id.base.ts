import { validate as isUUID } from 'uuid';
import { InvalidUUIDException, UUIDCannotBeEmptyException } from '../exceptions';

export abstract class BaseID {
  protected constructor(protected readonly _value: string) {
    const normalized = _value.trim();
    this.validate(normalized);
    this._value = normalized;
  }

  protected abstract validate(value: string): void;
}

export abstract class BaseUUID extends BaseID {
  protected constructor(value: string) {
    super(value);
  }

  protected validate(value: string): void {
    if (!value) throw new UUIDCannotBeEmptyException();
    if (!isUUID(value)) throw new InvalidUUIDException();
  }

  get value(): string {
    return this._value;
  }

  toString(): string {
    return this._value;
  }

  equals(other: this): boolean {
    return this.constructor === other.constructor && this._value === other._value;
  }
}
