import { Redis } from 'ioredis';

export interface RedisPort {
  client: Redis;
  set(key: string, value: any, ttl?: number): Promise<'OK'>;
  get<T = any>(key: string): Promise<T | null>;
  del(key: string): Promise<number>;
}

export const REDIS = Symbol('REDIS');
