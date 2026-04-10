import {
  EmailCannotBeEmptyException,
  EmailInvalidException,
  EmailMaxLengthExceededException,
} from '../exceptions';
import { Email } from './email.vo';

const VALID_EMAIL = 'test@example.com';
const VALID_EMAIL_UPPER_CASE = 'TEST@EXAMPLE.COM';

describe('Email Value Object', () => {
  describe('create()', () => {
    it('should create a valid email unchanged', () => {
      const email = Email.create(VALID_EMAIL);
      expect(email.value).toBe(VALID_EMAIL);
    });

    it('should trim and lowercase email', () => {
      const email = Email.create('  TeSt@ExAmple.CoM  ');
      expect(email.value).toBe('test@example.com');
    });

    it('should throw EmailCannotBeEmptyException if empty', () => {
      expect(() => Email.create('')).toThrow(EmailCannotBeEmptyException);
    });

    it('should throw EmailMaxLengthExceededException if too long', () => {
      const email = 'a'.repeat(256) + '@example.com';
      expect(() => Email.create(email)).toThrow(EmailMaxLengthExceededException);
    });

    it('should throw EmailInvalidException if invalid format', () => {
      expect(() => Email.create('invalid-email')).toThrow(EmailInvalidException);
    });
  });

  describe('reconstitute()', () => {
    it('reconstitute should create an email without validation and updating input', () => {
      const email = Email.reconstitute(VALID_EMAIL);
      expect(email.value).toBe(VALID_EMAIL);
    });

    it('should not normalize or validate input', () => {
      const raw = '  Test@Example.com ';
      const email = Email.reconstitute(raw);
      expect(email.value).toBe(raw); // exact value preserved
    });
  });

  describe('equals()', () => {
    it('should return true when emails are equal', () => {
      const email1 = Email.create(VALID_EMAIL);
      const email2 = Email.create(VALID_EMAIL_UPPER_CASE);
      expect(email1.equals(email2)).toBe(true);
    });

    it('should return false when emails are different', () => {
      const email1 = Email.create(VALID_EMAIL);
      const email2 = Email.create('other@example.com');
      expect(email1.equals(email2)).toBe(false);
    });

    it('should return false when comparing to undefined', () => {
      const email = Email.create(VALID_EMAIL);
      expect(email.equals(undefined)).toBe(false);
    });
  });

  describe('toString()', () => {
    it('should return the email value', () => {
      const email = Email.create(VALID_EMAIL);
      expect(email.toString()).toBe(VALID_EMAIL);
    });

    it('should return the same as value getter', () => {
      const email = Email.create(VALID_EMAIL);
      expect(email.toString()).toBe(email.value);
    });

    it('should work in string contexts', () => {
      const email = Email.create(VALID_EMAIL);
      expect(`Email: ${email}`).toBe(`Email: ${VALID_EMAIL}`);
    });
  });
});
