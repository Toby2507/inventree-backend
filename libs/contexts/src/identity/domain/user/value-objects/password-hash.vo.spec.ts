import { faker } from '@faker-js/faker';
import {
  PasswordHashCannotBeEmptyException,
  PasswordHashInvalidException,
} from '../exceptions/user.exceptions';
import { PasswordHash } from './password-hash.vo';

const VALID_HASH = faker.string.alphanumeric(128);

describe('Email Value Object', () => {
  describe('create()', () => {
    it('should create a valid password hash unchanged', () => {
      const hash = PasswordHash.create(VALID_HASH);
      expect(hash.value).toBe(VALID_HASH);
    });

    it('should trim hash', () => {
      const hash = PasswordHash.create('  ' + VALID_HASH + '  ');
      expect(hash.value).toBe(VALID_HASH);
    });

    it('should throw if hash is empty', () => {
      expect(() => PasswordHash.create('')).toThrow(PasswordHashCannotBeEmptyException);
    });

    it('should throw if hash is too short', () => {
      const hash = faker.string.alphanumeric(10);
      expect(() => PasswordHash.create(hash)).toThrow(PasswordHashInvalidException);
    });
  });

  describe('reconstitute()', () => {
    it('reconstitute should create an hash without validation and updating input', () => {
      const hash = PasswordHash.reconstitute(VALID_HASH);
      expect(hash.value).toBe(VALID_HASH);
    });

    it('should not normalize or validate input', () => {
      const raw = `  ${VALID_HASH} `;
      const hash = PasswordHash.reconstitute(raw);
      expect(hash.value).toBe(raw); // exact value preserved
    });
  });

  describe('toString()', () => {
    it('should return obfuscated string', () => {
      const hash = PasswordHash.create(VALID_HASH);
      expect(hash.toString()).toBe('[PasswordHash]');
    });

    it('should work in string contexts but with obfuscation', () => {
      const hash = PasswordHash.create(VALID_HASH);
      expect(`PasswordHash: ${hash}`).toBe(`PasswordHash: [PasswordHash]`);
    });
  });
});
