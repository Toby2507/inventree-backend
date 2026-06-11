import { Redis } from 'ioredis';

export interface RedisPort {
  client: Redis;
  get<T = any>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<'OK'>;
  setNX<T>(key: string, value: T, ttl?: number): Promise<'OK' | null>;
  del(...key: string[]): Promise<number>;
}

export const REDIS = Symbol('REDIS');
