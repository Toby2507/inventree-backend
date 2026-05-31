import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisPort } from './redis.port';
import { REDIS_CLIENT } from './redis.provider';

@Injectable()
export class RedisService implements OnModuleDestroy, RedisPort {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleDestroy() {
    await this.redis.quit();
  }

  get client(): Redis {
    return this.redis;
  }

  // optional: sugar helpers for JSON storage
  async set(key: string, value: any, ttl?: number) {
    const val = JSON.stringify(value);
    if (ttl) return this.redis.set(key, val, 'EX', ttl);
    return this.redis.set(key, val);
  }

  async get<T = any>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    return data ? (JSON.parse(data) as T) : null;
  }

  async del(key: string) {
    return this.redis.del(key);
  }
}
