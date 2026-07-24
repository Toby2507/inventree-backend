import { Duration } from './duration.vo';

export class Instant {
  private constructor(private readonly _instant: Temporal.Instant) {}

  // ==== FACTORY ==============
  static fromEpochMs(epochMs: number): Instant {
    return new Instant(Temporal.Instant.fromEpochMilliseconds(epochMs));
  }

  static fromTemporal(instant: Temporal.Instant): Instant {
    return new Instant(instant);
  }

  static fromDate(date: Date): Instant {
    return new Instant(Temporal.Instant.fromEpochMilliseconds(date.getTime()));
  }

  static parse(isoString: string): Instant {
    return new Instant(Temporal.Instant.from(isoString));
  }

  // ==== OPERATIONS ==============
  add(duration: Duration): Instant {
    return new Instant(
      this._instant.add(Temporal.Duration.from({ milliseconds: duration.toMs() })),
    );
  }

  subtract(duration: Duration): Instant {
    return new Instant(
      this._instant.subtract(Temporal.Duration.from({ milliseconds: duration.toMs() })),
    );
  }

  isBefore(other: Instant): boolean {
    return Temporal.Instant.compare(this._instant, other._instant) < 0;
  }

  isAfter(other: Instant): boolean {
    return Temporal.Instant.compare(this._instant, other._instant) > 0;
  }

  isAfterOrEqual(other: Instant): boolean {
    return Temporal.Instant.compare(this._instant, other._instant) >= 0;
  }

  equals(other: Instant): boolean {
    return Temporal.Instant.compare(this._instant, other._instant) === 0;
  }

  // ==== CONVERSIONS ==============
  toEpochMs(): number {
    return this._instant.epochMilliseconds;
  }

  toISOString(): string {
    return this._instant.toString();
  }

  toDate(): Date {
    return new Date(this._instant.epochMilliseconds);
  }
}
