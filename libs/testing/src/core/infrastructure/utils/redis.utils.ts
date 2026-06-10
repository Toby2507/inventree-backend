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
 * - a stop function to close the Redis connection
 *
 * @returns An object containing the Redis client, namespace, and cleanup function
 * @example ```
 * beforeAll(() => {
 *   ({ redis, cleanup, stop } = createTestRedis());
 * });
 * afterEach(async () => {
 *   await cleanup();
 * });
 * afterAll(async () => {
 *   await stop();
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
      const [next, keys] = await redis.scan(cursor, 'MATCH', '*');
      if (keys.length) await redis.unlink(...keys);
      cursor = next;
    } while (cursor !== '0');
  };
  const stop = async () => {
    await redis.quit();
  };

  return { redis, namespace, cleanup, stop };
};
