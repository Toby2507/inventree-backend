import {
  InvalidDurationException,
  InvalidDurationPartException,
} from '../exceptions/duration.exception';
import { Duration } from './duration.vo';

describe('Duration', () => {
  describe('factories - happy path', () => {
    it('should create from milliseconds', () => {
      expect(Duration.milliseconds(1000).toMs()).toBe(1000);
    });

    it('should create from seconds', () => {
      expect(Duration.seconds(1).toMs()).toBe(1000);
    });

    it('should create from minutes', () => {
      expect(Duration.minutes(1).toSeconds()).toBe(60);
    });

    it('should create from hours', () => {
      expect(Duration.hours(1).toMinutes()).toBe(60);
    });

    it('should create from days', () => {
      expect(Duration.days(1).toHours()).toBe(24);
    });

    it('should create from weeks', () => {
      expect(Duration.weeks(1).toDays()).toBe(7);
    });

    it('should allow zero as a valid value', () => {
      expect(Duration.hours(0).toMs()).toBe(0);
    });

    it('should round sub-millisecond input to the nearest millisecond', () => {
      expect(Duration.milliseconds(2.4).toMs()).toBe(2);
      expect(Duration.milliseconds(2.5).toMs()).toBe(3);
    });
  });

  describe('factories - validation', () => {
    const cases: Array<[string, (value: number) => Duration]> = [
      ['milliseconds', Duration.milliseconds],
      ['seconds', Duration.seconds],
      ['minutes', Duration.minutes],
      ['hours', Duration.hours],
      ['days', Duration.days],
      ['weeks', Duration.weeks],
    ];

    describe.each(cases)('%s', (_label, factory) => {
      it('should throw on negative values', () => {
        expect(() => factory(-1)).toThrow(InvalidDurationException);
      });

      it('should throw on NaN', () => {
        expect(() => factory(NaN)).toThrow(InvalidDurationException);
      });

      it('should throw on Infinity', () => {
        expect(() => factory(Infinity)).toThrow(InvalidDurationException);
      });
    });
  });

  describe('of()', () => {
    it('should sum mixed fixed-length units correctly', () => {
      const duration = Duration.of({ days: 1, hours: 6, minutes: 15 });
      const expectedMs = 1 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000 + 15 * 60 * 1000;
      expect(duration.toMs()).toBe(expectedMs);
    });

    it('should return zero duration for empty parts', () => {
      expect(Duration.of({}).toMs()).toBe(0);
    });

    it('should ignore undefined fields without throwing', () => {
      expect(() => Duration.of({ hours: 1, minutes: undefined })).not.toThrow();
    });

    it('should throw InvalidDurationException on a negative part', () => {
      expect(() => Duration.of({ hours: -5, minutes: 400 })).toThrow(InvalidDurationException);
    });

    it('should throw InvalidDurationException on a NaN part', () => {
      expect(() => Duration.of({ hours: NaN })).toThrow(InvalidDurationException);
    });

    it('should not accept calendar units at the type level', () => {
      // @ts-expect-error - months/years are intentionally excluded from DurationParts
      expect(() => Duration.of({ months: 1 })).toThrow(InvalidDurationPartException);
    });

    it('should throw InvalidDurationPartException (not InvalidDurationException) for an invalid key with an invalid value', () => {
      // @ts-expect-error - months/years are intentionally excluded from DurationParts
      expect(() => Duration.of({ months: -5 })).toThrow(InvalidDurationPartException);
    });
  });

  describe('arithmetic', () => {
    describe('plus', () => {
      it('should sum two durations correctly', () => {
        const result = Duration.hours(1).plus(Duration.minutes(30));
        expect(result.toMinutes()).toBe(90);
      });

      it('is not commutative-breaking (order does not matter)', () => {
        const a = Duration.hours(1).plus(Duration.minutes(30));
        const b = Duration.minutes(30).plus(Duration.hours(1));
        expect(a.equals(b)).toBe(true);
      });

      it('should not mutate the original instances (immutability)', () => {
        const original = Duration.hours(1);
        const result = original.plus(Duration.minutes(30));
        expect(original.toMinutes()).toBe(60);
        expect(result.toMinutes()).toBe(90);
      });
    });

    describe('minus', () => {
      it('should subtract correctly when result is non-negative', () => {
        const result = Duration.hours(2).minus(Duration.hours(1));
        expect(result.toHours()).toBe(1);
      });

      it('should allow a result of exactly zero', () => {
        const result = Duration.hours(1).minus(Duration.hours(1));
        expect(result.toMs()).toBe(0);
      });

      it('should throw InvalidDurationException when result would be negative', () => {
        expect(() => Duration.hours(1).minus(Duration.hours(2))).toThrow(InvalidDurationException);
      });
    });
  });

  describe('comparisons', () => {
    describe('equals', () => {
      it('should return true for equal durations built from different units', () => {
        expect(Duration.hours(1).equals(Duration.minutes(60))).toBe(true);
      });

      it('should return false for unequal durations', () => {
        expect(Duration.hours(1).equals(Duration.minutes(59))).toBe(false);
      });

      it('should return true for two independently-constructed zero durations', () => {
        expect(Duration.milliseconds(0).equals(Duration.hours(0))).toBe(true);
      });
    });

    describe('isLongerThan', () => {
      it('should return true when the first duration is greater', () => {
        expect(Duration.hours(2).isLongerThan(Duration.hours(1))).toBe(true);
      });

      it('should return false when both durations are equal', () => {
        expect(Duration.hours(1).isLongerThan(Duration.minutes(60))).toBe(false);
      });

      it('should return false when the first duration is smaller', () => {
        expect(Duration.hours(1).isLongerThan(Duration.hours(2))).toBe(false);
      });
    });

    describe('isLongerThanOrEquals', () => {
      it('should return true when the first duration is greater', () => {
        expect(Duration.hours(2).isLongerThanOrEqualTo(Duration.hours(1))).toBe(true);
      });

      it('should return true when both durations are equal', () => {
        expect(Duration.hours(1).isLongerThanOrEqualTo(Duration.minutes(60))).toBe(true);
      });

      it('should return false when the first duration is smaller', () => {
        expect(Duration.hours(1).isLongerThanOrEqualTo(Duration.hours(2))).toBe(false);
      });
    });

    describe('isShorterThan', () => {
      it('should return true when the first duration is smaller', () => {
        expect(Duration.hours(1).isShorterThan(Duration.hours(2))).toBe(true);
      });

      it('should return false when both durations are equal', () => {
        expect(Duration.hours(1).isShorterThan(Duration.minutes(60))).toBe(false);
      });

      it('should return false when the first duration is greater', () => {
        expect(Duration.hours(2).isShorterThan(Duration.hours(1))).toBe(false);
      });
    });

    describe('comparedTo', () => {
      it('should return 0 for equal durations', () => {
        expect(Duration.hours(1).comparedTo(Duration.minutes(60))).toBe(0);
      });

      it('should return a positive number when the first duration is greater', () => {
        expect(Duration.hours(2).comparedTo(Duration.hours(1))).toBeGreaterThan(0);
      });

      it('should return a negative number when the first duration is smaller', () => {
        expect(Duration.hours(1).comparedTo(Duration.hours(2))).toBeLessThan(0);
      });
    });
  });

  describe('conversions', () => {
    it('should convert ms -> seconds correctly', () => {
      expect(Duration.milliseconds(2500).toSeconds()).toBe(2.5);
    });

    it('should convert hours -> minutes correctly', () => {
      expect(Duration.hours(2).toMinutes()).toBe(120);
    });

    it('should convert days -> hours correctly', () => {
      expect(Duration.days(2).toHours()).toBe(48);
    });

    it('should convert weeks -> days correctly', () => {
      expect(Duration.weeks(2).toDays()).toBe(14);
    });

    it('should round-trip a compound duration through multiple units', () => {
      const duration = Duration.of({ weeks: 1, days: 2, hours: 3 });
      const expectedHours = 7 * 24 + 2 * 24 + 3;
      expect(duration.toHours()).toBe(expectedHours);
    });

    it('should keep toMs and toSeconds consistent with each other', () => {
      const duration = Duration.minutes(5);
      expect(duration.toMs()).toBe(duration.toSeconds() * 1000);
    });
  });
});
