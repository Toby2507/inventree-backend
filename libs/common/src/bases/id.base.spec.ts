import { faker } from '@app/testing/utils';
import { InvalidUUIDException, UUIDCannotBeEmptyException } from '../exceptions';
import { BaseUUID } from './id.base';

const validUUID = faker.string.uuid();

class TestID extends BaseUUID {
  constructor(value: string) {
    super(value);
  }
}

class TestID2 extends BaseUUID {
  constructor(value: string) {
    super(value);
  }
}

describe('BaseUUID Abstract Value Object', () => {
  describe('creation', () => {
    it('should throw if value is empty', () => {
      expect(() => new TestID('')).toThrow(UUIDCannotBeEmptyException);
    });

    it('should throw if value is not a valid UUID', () => {
      expect(() => new TestID('invalid-uuid')).toThrow(InvalidUUIDException);
    });

    it('should accept a valid UUID', () => {
      expect(() => new TestID(validUUID)).not.toThrow();
    });
  });

  describe('toString()', () => {
    it('should return the string value of the UUID', () => {
      const id = new TestID(validUUID);
      expect(id.toString()).toBe(validUUID);
    });

    it('should return the same value as the value getter', () => {
      const id = new TestID(validUUID);
      expect(id.toString()).toBe(id.value);
    });

    it('should work in string contexts', () => {
      const id = new TestID(validUUID);
      expect(`ID: ${id}`).toBe(`ID: ${validUUID}`);
    });
  });

  describe('equals()', () => {
    it('should return true for equal UUIDs', () => {
      const id1 = new TestID(validUUID);
      const id2 = new TestID(validUUID);
      expect(id1.equals(id2)).toBe(true);
    });

    it('should return false for different UUIDs', () => {
      const id1 = new TestID(validUUID);
      const id2 = new TestID(faker.string.uuid());
      expect(id1.equals(id2)).toBe(false);
    });

    it('should return false when comparing different classes with same UUID', () => {
      const id1 = new TestID(validUUID);
      const id2 = new TestID2(validUUID);
      expect(id1.equals(id2)).toBe(false);
    });

    it('should return false when comparing to undefined', () => {
      const id = new TestID(validUUID);
      expect(id.equals(undefined)).toBe(false);
    });
  });
});
