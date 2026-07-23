import { Duration } from '../value-objects/duration.vo';
import { Instant } from '../value-objects/instant.vo';
import { FixedClock } from './fixed-clock.adapter';

describe('FixedClock', () => {
  const START = Instant.fromEpochMs(1721606400000); // 2024-07-22T00:00:00Z

  it('should always return the instant it was constructed with', () => {
    const clock = new FixedClock(START);
    expect(clock.now().equals(START)).toBe(true);
    expect(clock.now().equals(START)).toBe(true); // stable across repeated calls
  });

  describe('advance', () => {
    it('should move the clock forward by the given duration', () => {
      const clock = new FixedClock(START);
      clock.advance(Duration.hours(2));
      expect(clock.now().equals(START.add(Duration.hours(2)))).toBe(true);
    });

    it('should accumulate across multiple advance calls', () => {
      const clock = new FixedClock(START);
      clock.advance(Duration.hours(1));
      clock.advance(Duration.minutes(30));
      expect(clock.now().equals(START.add(Duration.of({ hours: 1, minutes: 30 })))).toBe(true);
    });
  });

  describe('set', () => {
    it('should replace the clock instant directly', () => {
      const clock = new FixedClock(START);
      const target = START.add(Duration.days(1));
      clock.set(target);
      expect(clock.now().equals(target)).toBe(true);
    });
  });
});
