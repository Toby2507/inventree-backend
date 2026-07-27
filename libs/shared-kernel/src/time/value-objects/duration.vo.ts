import {
  InvalidDurationException,
  InvalidDurationPartException,
} from '../exceptions/duration.exception';

type DurationParts = Partial<
  Pick<
    Temporal.DurationLikeObject,
    'weeks' | 'days' | 'hours' | 'minutes' | 'seconds' | 'milliseconds'
  >
>;

const MS_PER_UNIT: Record<keyof DurationParts, number> = {
  weeks: 7 * 24 * 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
  hours: 60 * 60 * 1000,
  minutes: 60 * 1000,
  seconds: 1000,
  milliseconds: 1,
};
const validKeys: Set<keyof DurationParts> = new Set([
  'weeks',
  'days',
  'hours',
  'minutes',
  'seconds',
  'milliseconds',
]);

/**
 * Represents a non-negative elapsed duration, stored internally as milliseconds.
 * Sub-millisecond precision is not supported — inputs are rounded via Math.round.
 */
export class Duration {
  private constructor(private readonly _duration: Temporal.Duration) {}

  private static validate(value: number): void {
    if (!Number.isFinite(value) || value < 0) throw new InvalidDurationException();
  }

  private static fromMs(ms: number): Duration {
    return new Duration(Temporal.Duration.from({ milliseconds: Math.round(ms) }));
  }

  // ==== FACTORY ==============
  static zero(): Duration {
    return Duration.fromMs(0);
  }

  static milliseconds(milliseconds: number): Duration {
    Duration.validate(milliseconds);
    return Duration.fromMs(milliseconds);
  }

  static seconds(seconds: number): Duration {
    Duration.validate(seconds);
    return Duration.fromMs(seconds * MS_PER_UNIT.seconds);
  }

  static minutes(minutes: number): Duration {
    Duration.validate(minutes);
    return Duration.fromMs(minutes * MS_PER_UNIT.minutes);
  }

  static hours(hours: number): Duration {
    Duration.validate(hours);
    return Duration.fromMs(hours * MS_PER_UNIT.hours);
  }

  static days(days: number): Duration {
    Duration.validate(days);
    return Duration.fromMs(days * MS_PER_UNIT.days);
  }

  static weeks(weeks: number): Duration {
    Duration.validate(weeks);
    return Duration.fromMs(weeks * MS_PER_UNIT.weeks);
  }

  static of(parts: DurationParts): Duration {
    const totalMs = (Object.entries(parts) as Array<[keyof DurationParts, number]>).reduce(
      (sum, [key, value]) => {
        if (value === undefined) return sum;
        if (!validKeys.has(key)) throw new InvalidDurationPartException(key);
        if (!Number.isFinite(value) || value < 0) throw new InvalidDurationException(key);
        return sum + value * MS_PER_UNIT[key];
      },
      0,
    );
    return Duration.fromMs(totalMs);
  }

  // ==== OPERATIONS ==============
  plus(other: Duration): Duration {
    return Duration.fromMs(this.toMs() + other.toMs());
  }

  minus(other: Duration): Duration {
    const resultMs = this.toMs() - other.toMs();
    if (resultMs < 0) throw new InvalidDurationException();
    return Duration.fromMs(resultMs);
  }

  equals(other: Duration): boolean {
    return this.comparedTo(other) === 0;
  }

  isLongerThan(other: Duration): boolean {
    return this.comparedTo(other) > 0;
  }

  isLongerThanOrEqualTo(other: Duration): boolean {
    return this.comparedTo(other) >= 0;
  }

  isShorterThan(other: Duration): boolean {
    return this.comparedTo(other) < 0;
  }

  comparedTo(other: Duration): number {
    return Temporal.Duration.compare(this._duration, other._duration);
  }

  // ==== CONVERSIONS ==============
  toMs(): number {
    return this._duration.total('milliseconds');
  }

  toSeconds(): number {
    return this.toMs() / MS_PER_UNIT.seconds;
  }

  toMinutes(): number {
    return this.toMs() / MS_PER_UNIT.minutes;
  }

  toHours(): number {
    return this.toMs() / MS_PER_UNIT.hours;
  }

  toDays(): number {
    return this.toMs() / MS_PER_UNIT.days;
  }

  toWeeks(): number {
    return this.toMs() / MS_PER_UNIT.weeks;
  }
}
