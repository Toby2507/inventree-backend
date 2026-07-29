import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import type { Redis as IoRedis } from 'ioredis';
import type { Redis } from './redis.port';
import { REDIS_CLIENT } from './redis.provider';

@Injectable()
export class RedisService implements OnModuleDestroy, Redis {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: IoRedis) {}

  get client(): IoRedis {
    return this.redis;
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  // optional: sugar helpers for JSON storage
  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    return data ? (JSON.parse(data) as T) : null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<'OK'> {
    const val = JSON.stringify(value);
    return ttl ? this.redis.set(key, val, 'EX', ttl) : this.redis.set(key, val);
  }

  async setNX<T>(key: string, value: T, ttl?: number): Promise<'OK' | null> {
    const val = JSON.stringify(value);
    return ttl ? this.redis.set(key, val, 'EX', ttl, 'NX') : this.redis.set(key, val, 'NX');
  }

  async del(...key: string[]): Promise<number> {
    return this.redis.del(...key);
  }
}
