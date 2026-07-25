import type { Clock } from '../ports/clock.port';
import { Instant } from '../value-objects/instant.vo';

export class SystemClockAdapter implements Clock {
  now(): Instant {
    return Instant.fromTemporal(Temporal.Now.instant());
  }
}
