import type { Instant } from '../value-objects/instant.vo';

export interface Clock {
  now(): Instant;
}

export const CLOCK = Symbol('CLOCK');
