import { InvalidInstantException } from '../exceptions/instant.exception';
import type { Duration } from './duration.vo';

/**
 * Value object wrapping Temporal.Instant.
 * Use `.equals()` for comparisons — reference equality and
 * structural equality (Map/Set keys, Jest `toEqual`) do NOT hold.
 * For test assertions, compare via `.toISOString()` or `.equals()`.
 */
export class Instant {
  private constructor(private readonly _instant: Temporal.Instant) {}

  // ==== FACTORY ==============
  static fromDate(date: Date): Instant {
    const ms = date.getTime();
    if (Number.isNaN(ms)) throw new InvalidInstantException(date);
    return Instant.fromEpochMs(ms);
  }

  static fromEpochMs(epochMs: number): Instant {
    if (!Number.isFinite(epochMs)) throw new InvalidInstantException(epochMs);
    try {
      return new Instant(Temporal.Instant.fromEpochMilliseconds(epochMs));
    } catch (error: unknown) {
      throw new InvalidInstantException(epochMs, error);
    }
  }

  static fromTemporal(instant: Temporal.Instant): Instant {
    return new Instant(instant);
  }

  static parse(isoString: string): Instant {
    try {
      return new Instant(Temporal.Instant.from(isoString));
    } catch (error: unknown) {
      throw new InvalidInstantException(isoString, error);
    }
  }

  // ==== OPERATIONS ==============
  plus(duration: Duration): Instant {
    return new Instant(
      this._instant.add(Temporal.Duration.from({ milliseconds: duration.toMs() })),
    );
  }

  minus(duration: Duration): Instant {
    return new Instant(
      this._instant.subtract(Temporal.Duration.from({ milliseconds: duration.toMs() })),
    );
  }

  equals(other: Instant): boolean {
    return this.comparedTo(other) === 0;
  }

  isAfter(other: Instant): boolean {
    return this.comparedTo(other) > 0;
  }

  isAfterOrEqualTo(other: Instant): boolean {
    return this.comparedTo(other) >= 0;
  }

  isBefore(other: Instant): boolean {
    return this.comparedTo(other) < 0;
  }

  comparedTo(other: Instant): number {
    return Temporal.Instant.compare(this._instant, other._instant);
  }

  // ==== CONVERSIONS ==============
  toDate(): Date {
    return new Date(this._instant.epochMilliseconds);
  }

  toEpochMs(): number {
    return this._instant.epochMilliseconds;
  }

  toISOString(): string {
    return this._instant.toString();
  }

  toJSON(): string {
    return this.toISOString();
  }
}
