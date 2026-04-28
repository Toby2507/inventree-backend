import { validate as isUUID } from 'uuid';
import { InvalidUUIDException, UUIDCannotBeEmptyException } from '../exceptions';

export abstract class BaseId {
  protected constructor(protected readonly value: string) {
    const normalized = value.trim();
    this.validate(normalized);
    this.value = normalized;
  }

  protected abstract validate(value: string): void;
}

export abstract class BaseUUID extends BaseId {
  protected constructor(value: string) {
    super(value);
  }

  protected validate(value: string): void {
    if (!value) throw new UUIDCannotBeEmptyException();
    if (!isUUID(value)) throw new InvalidUUIDException();
  }

  toString(): string {
    return this.value;
  }

  equals(other: this): boolean {
    return this.constructor === other.constructor && this.value === other.value;
  }
}
