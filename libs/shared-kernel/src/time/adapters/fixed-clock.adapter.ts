import type { Clock } from '../ports/clock.port';
import type { Duration } from '../value-objects/duration.vo';
import type { Instant } from '../value-objects/instant.vo';

export class FixedClock implements Clock {
  constructor(private instant: Instant) {}

  now(): Instant {
    return this.instant;
  }

  advance(duration: Duration): void {
    this.instant = this.instant.plus(duration);
  }

  set(instant: Instant): void {
    this.instant = instant;
  }
}
