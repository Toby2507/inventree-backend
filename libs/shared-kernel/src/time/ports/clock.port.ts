import { Instant } from '../value-objects/instant.vo';

export interface ClockPort {
  now(): Instant;
}

export const CLOCK = Symbol('CLOCK');
