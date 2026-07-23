import { ClockPort } from '../ports/clock.port';
import { Instant } from '../value-objects/instant.vo';

export class SystemClockAdapter implements ClockPort {
  now(): Instant {
    return Instant.fromTemporal(Temporal.Now.instant());
  }
}
