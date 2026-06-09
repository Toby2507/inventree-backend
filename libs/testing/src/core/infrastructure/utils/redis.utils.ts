import { Redis, type RedisOptions } from 'ioredis';

const getRedisConfig = (): RedisOptions => ({
  host: process.env.TEST_REDIS_HOST || 'localhost',
  port: Number(process.env.TEST_REDIS_PORT) || 6379,
  password: process.env.TEST_REDIS_PASSWORD || undefined,
});

/**
 * Creates a reusable Redis client for testing with:
 * - a unique key prefix to isolate test data
 * - a cleanup function to remove test keys after tests complete
 *
 * @returns An object containing the Redis client, namespace, and cleanup function
 * @example ```
 * beforeAll(() => {
 *   ({ redis, cleanup } = createTestRedis());
 * });
 * afterAll(async () => {
 *   await cleanup();
 * });
 * ```
 */
export const createTestRedis = () => {
  const namespace = `test:${process.pid}:${Date.now()}`;
  const redis = new Redis({
    ...getRedisConfig(),
    keyPrefix: `${namespace}:`,
  });

  const cleanup = async () => {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', `${namespace}:*`);
      if (keys.length) await redis.del(...keys);
      cursor = next;
    } while (cursor !== '0');
  };

  return { redis, namespace, cleanup };
};
