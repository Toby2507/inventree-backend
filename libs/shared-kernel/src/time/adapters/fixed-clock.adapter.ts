import { ClockPort } from '../ports/clock.port';
import { Duration } from '../value-objects/duration.vo';
import { Instant } from '../value-objects/instant.vo';

export class FixedClock implements ClockPort {
  constructor(private instant: Instant) {}

  now(): Instant {
    return this.instant;
  }

  advance(duration: Duration): void {
    this.instant = this.instant.add(duration);
  }

  set(instant: Instant): void {
    this.instant = instant;
  }
}
