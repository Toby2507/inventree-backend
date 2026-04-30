import { PhoneNumber } from './phone.vo';
import { InvalidPhoneNumberException, PhoneNumberCannotBeEmptyException } from '../exceptions';

describe('PhoneNumber Value Object', () => {
  describe('create()', () => {
    it('should create a valid phone number when given a valid E.164 number', () => {
      const phone = PhoneNumber.create('+2348031234567');
      expect(phone.value).toBe('+2348031234567');
    });

    it('should normalize by removing spaces, dashes, and parentheses', () => {
      const phone = PhoneNumber.create('+234 (803) 123-4567');
      expect(phone.value).toBe('+2348031234567');
    });

    it('should throw if value is empty', () => {
      expect(() => PhoneNumber.create('')).toThrow(PhoneNumberCannotBeEmptyException);
    });

    it('should throw if value is null or undefined', () => {
      expect(() => PhoneNumber.create(null as unknown as string)).toThrow(
        PhoneNumberCannotBeEmptyException,
      );
      expect(() => PhoneNumber.create(undefined as unknown as string)).toThrow(
        PhoneNumberCannotBeEmptyException,
      );
    });

    it('should throw for invalid phone number format (no +)', () => {
      expect(() => PhoneNumber.create('08031234567')).toThrow(InvalidPhoneNumberException);
    });

    it('should throw for invalid E.164 format', () => {
      expect(() => PhoneNumber.create('+123')).toThrow(InvalidPhoneNumberException);
    });

    it('should throw for malformed numbers', () => {
      expect(() => PhoneNumber.create('+234abc123456')).toThrow(InvalidPhoneNumberException);
    });
  });

  describe('reconstitute()', () => {
    it('should create a PhoneNumber without validation', () => {
      const phone = PhoneNumber.reconstitute('+2348031234567');
      expect(phone.value).toBe('+2348031234567');
    });

    it('should not normalize or validate value', () => {
      const raw = '+234 803 123 4567';
      const phone = PhoneNumber.reconstitute(raw);
      expect(phone.value).toBe(raw); // exact value preserved
    });
  });

  describe('equals()', () => {
    it('should return true for equal phone numbers', () => {
      const a = PhoneNumber.create('+2348031234567');
      const b = PhoneNumber.create('+2348031234567');
      expect(a.equals(b)).toBe(true);
    });

    it('should return false for different phone numbers', () => {
      const a = PhoneNumber.create('+2348031234567');
      const b = PhoneNumber.create('+2348012345678');
      expect(a.equals(b)).toBe(false);
    });

    it('should return false when comparing with undefined', () => {
      const a = PhoneNumber.create('+2348031234567');
      expect(a.equals(undefined)).toBe(false);
    });
  });

  describe('toString()', () => {
    it('should return the phone number value', () => {
      const phone = PhoneNumber.create('+2348031234567');
      expect(phone.toString()).toBe('+2348031234567');
    });

    it('should return the same as value getter', () => {
      const phone = PhoneNumber.create('+2348031234567');
      expect(phone.toString()).toBe(phone.value);
    });

    it('should work in string contexts', () => {
      const phone = PhoneNumber.create('+2348031234567');
      expect(`Phone: ${phone}`).toBe('Phone: +2348031234567');
    });
  });
});
