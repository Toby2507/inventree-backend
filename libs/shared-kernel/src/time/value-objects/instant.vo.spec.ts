import { InvalidInstantException } from '../exceptions/instant.exception';
import { Duration } from './duration.vo';
import { Instant } from './instant.vo';

describe('Instant Value Object', () => {
  const EPOCH_MS = 1721606400000; // 2024-07-22T00:00:00.000Z

  describe('factories', () => {
    it('should create from epoch milliseconds', () => {
      expect(Instant.fromEpochMs(EPOCH_MS).toEpochMs()).toBe(EPOCH_MS);
    });

    it('should create from a native Temporal.Instant', () => {
      const temporalInstant = Temporal.Instant.fromEpochMilliseconds(EPOCH_MS);
      expect(Instant.fromTemporal(temporalInstant).toEpochMs()).toBe(EPOCH_MS);
    });

    it('should create from a native Date', () => {
      const date = new Date(EPOCH_MS);
      expect(Instant.fromDate(date).toEpochMs()).toBe(EPOCH_MS);
    });

    it('should create from an ISO 8601 string', () => {
      const isoString = '2024-07-22T00:00:00Z';
      expect(Instant.parse(isoString).toEpochMs()).toBe(EPOCH_MS);
    });

    it('should ensure two instants built from the same epoch ms are equal', () => {
      const a = Instant.fromEpochMs(EPOCH_MS);
      const b = Instant.fromTemporal(Temporal.Instant.fromEpochMilliseconds(EPOCH_MS));
      expect(a.equals(b)).toBe(true);
    });

    it('should throw for epoch ms beyond Temporal.Instant range', () => {
      expect(() => Instant.fromEpochMs(Number.MAX_SAFE_INTEGER)).toThrow(InvalidInstantException);
    });

    it('should not throw for epoch ms within Temporal.Instant range', () => {
      const maxValidMs = 8_640_000_000_000_000;
      expect(() => Instant.fromEpochMs(maxValidMs)).not.toThrow();
      expect(() => Instant.fromEpochMs(-maxValidMs)).not.toThrow();
    });

    describe('invalid input', () => {
      it('should throw InvalidInstantException for a malformed ISO string', () => {
        expect(() => Instant.parse('not-a-date')).toThrow(InvalidInstantException);
      });

      it('should throw InvalidInstantException for NaN epoch ms', () => {
        expect(() => Instant.fromEpochMs(NaN)).toThrow(InvalidInstantException);
      });

      it('should throw InvalidInstantException for an invalid Date', () => {
        expect(() => Instant.fromDate(new Date('garbage'))).toThrow(InvalidInstantException);
      });
    });
  });

  describe('arithmetic', () => {
    describe('plus', () => {
      it('should add a Duration and return a new later Instant', () => {
        const now = Instant.fromEpochMs(EPOCH_MS);
        const later = now.plus(Duration.hours(2));
        expect(later.toEpochMs()).toBe(EPOCH_MS + 2 * 60 * 60 * 1000);
      });

      it('should not mutate the original instant (immutability)', () => {
        const now = Instant.fromEpochMs(EPOCH_MS);
        const later = now.plus(Duration.hours(2));
        expect(now.toEpochMs()).toBe(EPOCH_MS);
        expect(later.toEpochMs()).not.toBe(now.toEpochMs());
      });

      it('should ensure adding a zero duration returns an equal instant', () => {
        const now = Instant.fromEpochMs(EPOCH_MS);
        const same = now.plus(Duration.milliseconds(0));
        expect(same.equals(now)).toBe(true);
      });

      it('should compose correctly with a compound Duration', () => {
        const now = Instant.fromEpochMs(EPOCH_MS);
        const later = now.plus(Duration.of({ days: 1, hours: 6 }));
        const expectedMs = EPOCH_MS + (24 + 6) * 60 * 60 * 1000;
        expect(later.toEpochMs()).toBe(expectedMs);
      });
    });

    describe('minus', () => {
      it('should subtract a Duration and return a new earlier Instant', () => {
        const now = Instant.fromEpochMs(EPOCH_MS);
        const earlier = now.minus(Duration.hours(2));
        expect(earlier.toEpochMs()).toBe(EPOCH_MS - 2 * 60 * 60 * 1000);
      });

      it('should ensure subtracting then adding returns to the original instant', () => {
        const now = Instant.fromEpochMs(EPOCH_MS);
        const roundTrip = now.minus(Duration.hours(3)).plus(Duration.hours(3));
        expect(roundTrip.equals(now)).toBe(true);
      });
    });
  });

  describe('comparisons', () => {
    describe('isBefore', () => {
      it('should return true when this instant is earlier', () => {
        const earlier = Instant.fromEpochMs(EPOCH_MS);
        const later = earlier.plus(Duration.hours(1));
        expect(earlier.isBefore(later)).toBe(true);
      });

      it('should return false when equal', () => {
        const a = Instant.fromEpochMs(EPOCH_MS);
        const b = Instant.fromEpochMs(EPOCH_MS);
        expect(a.isBefore(b)).toBe(false);
      });

      it('should return false when this instant is later', () => {
        const earlier = Instant.fromEpochMs(EPOCH_MS);
        const later = earlier.plus(Duration.hours(1));
        expect(later.isBefore(earlier)).toBe(false);
      });
    });

    describe('isAfter', () => {
      it('should return true when this instant is later', () => {
        const earlier = Instant.fromEpochMs(EPOCH_MS);
        const later = earlier.plus(Duration.hours(1));
        expect(later.isAfter(earlier)).toBe(true);
      });

      it('should return false when equal', () => {
        const a = Instant.fromEpochMs(EPOCH_MS);
        const b = Instant.fromEpochMs(EPOCH_MS);
        expect(a.isAfter(b)).toBe(false);
      });
    });

    describe('isAfterOrEqual', () => {
      it('should return true when this instant is later', () => {
        const earlier = Instant.fromEpochMs(EPOCH_MS);
        const later = earlier.plus(Duration.hours(1));
        expect(later.isAfterOrEqualTo(earlier)).toBe(true);
      });

      it('should return true when equal', () => {
        const a = Instant.fromEpochMs(EPOCH_MS);
        const b = Instant.fromEpochMs(EPOCH_MS);
        expect(a.isAfterOrEqualTo(b)).toBe(true);
      });

      it('should return false when this instant is earlier', () => {
        const earlier = Instant.fromEpochMs(EPOCH_MS);
        const later = earlier.plus(Duration.hours(1));
        expect(earlier.isAfterOrEqualTo(later)).toBe(false);
      });
    });

    describe('equals', () => {
      it('should return true for two instants built from the same epoch ms', () => {
        const a = Instant.fromEpochMs(EPOCH_MS);
        const b = Instant.fromTemporal(Temporal.Instant.fromEpochMilliseconds(EPOCH_MS));
        expect(a.equals(b)).toBe(true);
      });

      it('should return false for two instants built from different epoch ms', () => {
        const a = Instant.fromEpochMs(EPOCH_MS);
        const b = Instant.fromEpochMs(EPOCH_MS + 1);
        expect(a.equals(b)).toBe(false);
      });

      it('should return true for two equal instants built from different methods', () => {
        const a = Instant.fromEpochMs(EPOCH_MS);
        const b = Instant.fromTemporal(Temporal.Instant.fromEpochMilliseconds(EPOCH_MS));
        expect(a.equals(b)).toBe(true);
      });

      it('should return true for two instants that are equal after adding and subtracting the same duration', () => {
        const a = Instant.fromEpochMs(EPOCH_MS);
        const b = a.plus(Duration.hours(1)).minus(Duration.hours(1));
        expect(a.equals(b)).toBe(true);
      });
    });

    describe('comparedTo', () => {
      it('should return 0 for two equal instants', () => {
        const a = Instant.fromEpochMs(EPOCH_MS);
        const b = Instant.fromEpochMs(EPOCH_MS);
        expect(a.comparedTo(b)).toBe(0);
      });

      it('should return a negative number when this instant is earlier', () => {
        const earlier = Instant.fromEpochMs(EPOCH_MS);
        const later = earlier.plus(Duration.hours(1));
        expect(earlier.comparedTo(later)).toBeLessThan(0);
      });

      it('should return a positive number when this instant is later', () => {
        const earlier = Instant.fromEpochMs(EPOCH_MS);
        const later = earlier.plus(Duration.hours(1));
        expect(later.comparedTo(earlier)).toBeGreaterThan(0);
      });
    });
  });

  describe('conversions', () => {
    it('should return a valid ISO 8601 string when toISOString is called', () => {
      const instant = Instant.fromEpochMs(EPOCH_MS);
      expect(instant.toISOString()).toBe('2024-07-22T00:00:00Z');
    });

    it('should return a native Date with the same epoch ms when toDate is called', () => {
      const instant = Instant.fromEpochMs(EPOCH_MS);
      const date = instant.toDate();
      expect(date).toBeInstanceOf(Date);
      expect(date.getTime()).toBe(EPOCH_MS);
    });

    it('should return the correct epoch milliseconds when toEpochMs is called', () => {
      expect(Instant.fromEpochMs(EPOCH_MS).toEpochMs()).toBe(EPOCH_MS);
    });

    it('should serialize to its ISO string via JSON.stringify', () => {
      const instant = Instant.fromEpochMs(EPOCH_MS);
      expect(JSON.stringify({ at: instant })).toBe(`{"at":"2024-07-22T00:00:00Z"}`);
    });
  });
});
