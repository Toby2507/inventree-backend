import { faker } from '@faker-js/faker';
import {
  PersonNameCannotBeEmptyException,
  PersonNameInvalidException,
  PersonNameMaxLengthExceededException,
} from '../exceptions/user.exceptions';
import { PersonName } from './person-name.vo';

const VALID_NAME = faker.person.fullName();
describe('PersonName Value Object', () => {
  describe('create()', () => {
    it('should create a valid name unchanged', () => {
      const name = PersonName.create(VALID_NAME);
      expect(name.value).toBe(VALID_NAME);
    });

    it('should trim names', () => {
      const name = PersonName.create('  John Doe  ');
      expect(name.value).toBe('John Doe');
    });

    it('should throw if name is empty', () => {
      expect(() => PersonName.create('')).toThrow(PersonNameCannotBeEmptyException);
    });

    it('should throw if name is too long', () => {
      const name = 'a'.repeat(256) + '@example.com';
      expect(() => PersonName.create(name)).toThrow(PersonNameMaxLengthExceededException);
    });

    it('should throw if name includes ascii control characters', () => {
      expect(() => PersonName.create('John\nDoe')).toThrow(PersonNameInvalidException);
    });
  });

  describe('reconstitute()', () => {
    it('reconstitute should create a name without validation and updating input', () => {
      const name = PersonName.reconstitute(VALID_NAME);
      expect(name.value).toBe(VALID_NAME);
    });

    it('should not normalize or validate input', () => {
      const raw = '  John Doe ';
      const name = PersonName.reconstitute(raw);
      expect(name.value).toBe(raw); // exact value preserved
    });
  });

  describe('equals()', () => {
    it('should return true when names are equal', () => {
      const name1 = PersonName.create(VALID_NAME);
      const name2 = PersonName.create(` ${VALID_NAME}`);
      expect(name1.equals(name2)).toBe(true);
    });

    it('should return false when names are different', () => {
      const name1 = PersonName.create(VALID_NAME);
      const name2 = PersonName.create('Jane Doe');
      expect(name1.equals(name2)).toBe(false);
    });

    it('should return false when comparing to undefined', () => {
      const name = PersonName.create(VALID_NAME);
      expect(name.equals(undefined)).toBe(false);
    });
  });

  describe('toString()', () => {
    it('should return the name value', () => {
      const name = PersonName.create(VALID_NAME);
      expect(name.toString()).toBe(VALID_NAME);
    });

    it('should return the same as value getter', () => {
      const name = PersonName.create(VALID_NAME);
      expect(name.toString()).toBe(name.value);
    });

    it('should work in string contexts', () => {
      const name = PersonName.create(VALID_NAME);
      expect(`Name: ${name}`).toBe(`Name: ${VALID_NAME}`);
    });
  });
});
