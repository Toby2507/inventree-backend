import { Instant } from '../value-objects/instant.vo';
import { SystemClockAdapter } from './system-clock.adapter';

describe('SystemClock Adapter', () => {
  let clock: SystemClockAdapter;

  beforeEach(() => {
    clock = new SystemClockAdapter();
  });

  it('should return an Instant representing the current time', () => {
    const before = Date.now();
    const now = clock.now();
    const after = Date.now();
    expect(now).toBeInstanceOf(Instant);
    expect(now.toEpochMs()).toBeGreaterThanOrEqual(before);
    expect(now.toEpochMs()).toBeLessThanOrEqual(after);
  });

  it('should return a later Instant on successive calls', async () => {
    const first = clock.now();
    await new Promise((resolve) => setTimeout(resolve, 5)); // Wait for 10ms
    const second = clock.now();
    expect(second).toBeInstanceOf(Instant);
    expect(second.isAfter(first)).toBe(true);
  });
});
