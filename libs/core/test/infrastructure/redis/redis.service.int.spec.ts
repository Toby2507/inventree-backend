import { Fn } from '@app/common/types';
import { REDIS_CLIENT } from '@app/core/infrastructure/redis/redis.provider';
import { RedisService } from '@app/core/infrastructure/redis/redis.service';
import { createTestRedis } from '@app/testing/core/infrastructure';
import { Test, TestingModule } from '@nestjs/testing';
import { Redis } from 'ioredis';

describe('RedisService (integration)', () => {
  let module: TestingModule;
  let service: RedisService;
  let redis: Redis;
  let cleanup: Fn;
  let stop: Fn;

  beforeAll(async () => {
    ({ redis, cleanup, stop } = createTestRedis());
    module = await Test.createTestingModule({
      providers: [RedisService, { provide: REDIS_CLIENT, useValue: redis }],
    }).compile();
    await module.init();
    service = module.get(RedisService);
  });

  afterEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    // Spy suppresses the real quit so we control teardown order
    jest.spyOn(redis, 'quit').mockResolvedValueOnce('OK');
    await module.close();
    await stop();
  });

  describe('client', () => {
    it('should expose the underlying Redis instance', () => {
      expect(service.client).toBe(redis);
    });
  });

  describe('set', () => {
    it('should return OK on success', async () => {
      const result = await service.set('k', 'v');
      expect(result).toBe('OK');
    });

    it('should store a primitive string as JSON', async () => {
      await service.set('str', 'hello');
      const raw = await redis.get('str');
      expect(raw).toBe(JSON.stringify('hello'));
    });

    it.each([
      ['a plain number', 42],
      ['a boolean', true],
      ['null', null],
      ['a plain object', { id: 1, name: 'Alice' }],
      ['an array', [1, 2, 3]],
    ])('should store %s as JSON', async (_, value) => {
      await service.set('key', value);
      const raw = await redis.get('key');
      expect(JSON.parse(raw!)).toEqual(value);
    });

    it('should set a positive TTL when provided', async () => {
      await service.set('ttl-key', 'val', 30);
      const ttl = await redis.ttl('ttl-key');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(30);
    });

    it('should not set a TTL when none is provided', async () => {
      await service.set('no-ttl', 'val');
      const ttl = await redis.ttl('no-ttl');
      expect(ttl).toBe(-1); // -1 → key exists with no expiry
    });

    it('should overwrite an existing key', async () => {
      await service.set('key', 'original');
      await service.set('key', 'updated');
      const result = await service.get<string>('key');
      expect(result).toBe('updated');
    });
  });

  describe('setNX', () => {
    it('should return OK and store the value when the key is absent', async () => {
      const result = await service.setNX('nx', 'first');
      expect(result).toBe('OK');
      expect(await service.get<string>('nx')).toBe('first');
    });

    it('should return null and not overwrite when the key exists', async () => {
      await service.set('nx', 'original');
      const result = await service.setNX('nx', 'new');
      expect(result).toBeNull();
      await expect(service.get<string>('nx')).resolves.toBe('original');
    });

    it('should set a positive TTL when provided and the key is absent', async () => {
      await service.setNX('nx-ttl', 'val', 30);
      const ttl = await redis.ttl('nx-ttl');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(30);
    });

    it('should not set TTL when key already exists', async () => {
      await service.set('nx-ttl', 'val');
      await service.setNX('nx-ttl', 'val2', 30);
      const ttl = await redis.ttl('nx-ttl');
      expect(ttl).toBe(-1);
    });
  });

  describe('get', () => {
    it('should return null for a missing key', async () => {
      const result = await service.get('missing');
      expect(result).toBeNull();
    });

    it('should deserialize a stored string', async () => {
      await service.set('str', 'world');
      await expect(service.get<string>('str')).resolves.toBe('world');
    });

    it.each([
      ['number', 42],
      ['boolean', true],
      ['null', null],
      ['object', { x: 42, nested: { flag: true } }],
      ['array', [1, 2, 3]],
    ])('should deserialize a stored %s', async (_, value) => {
      await service.set('key', value);
      await expect(service.get<typeof value>('key')).resolves.toEqual(value);
    });

    it('should return null after a key expires', async () => {
      await service.set('exp', 'soon', 1);
      await new Promise((r) => setTimeout(r, 1100));
      await expect(service.get('exp')).resolves.toBeNull();
    });

    it('should throw for malformed JSON', async () => {
      await redis.set('bad', '{'); // Invalid JSON
      await expect(service.get('bad')).rejects.toThrow();
    });
  });

  describe('del', () => {
    it('should return 0 for a non-existent key', async () => {
      await expect(service.del('ghost')).resolves.toBe(0);
    });

    it('should throw if del is called with no keys', async () => {
      await expect(service.del()).rejects.toThrow();
    });

    it('should delete a single key and return 1', async () => {
      await service.set('k', 'v');
      await expect(service.del('k')).resolves.toBe(1);
      await expect(service.get('k')).resolves.toBeNull();
    });

    it('should delete multiple keys and return the count', async () => {
      await Promise.all([service.set('k1', 1), service.set('k2', 2), service.set('k3', 3)]);
      await expect(service.del('k1', 'k2', 'k3')).resolves.toBe(3);
    });

    it('should count only the keys that actually existed', async () => {
      await service.set('real', 'v');
      await expect(service.del('real', 'phantom')).resolves.toBe(1);
    });
  });
});
