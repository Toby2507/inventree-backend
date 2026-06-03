import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisPort } from './redis.port';
import { REDIS_CLIENT } from './redis.provider';

@Injectable()
export class RedisService implements OnModuleDestroy, RedisPort {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  get client(): Redis {
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
