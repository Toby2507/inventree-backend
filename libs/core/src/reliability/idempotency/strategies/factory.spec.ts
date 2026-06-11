import { makeIdempotencyStrategyMock } from '@app/testing/core/reliability/idempotency';
import { DurableIdempotencyStrategy } from './durable.strategy';
import { IdempotencyStrategyFactory } from './factory';
import { RedisIdempotencyStrategy } from './redis.strategy';

describe('IdempotencyStrategyFactory', () => {
  let factory: IdempotencyStrategyFactory;

  const redisStrategy = makeIdempotencyStrategyMock<RedisIdempotencyStrategy>();
  const durableStrategy = makeIdempotencyStrategyMock<DurableIdempotencyStrategy>();

  beforeEach(async () => {
    factory = new IdempotencyStrategyFactory(redisStrategy, durableStrategy);
  });

  describe('get()', () => {
    it('should return the redis strategy', () => {
      const strategy = factory.get('redis');
      expect(strategy).toBe(redisStrategy);
    });

    it('should return the durable strategy', () => {
      const strategy = factory.get('durable');
      expect(strategy).toBe(durableStrategy);
    });

    it('should throw for an invalid strategy', () => {
      expect(() => factory.get('unknown' as any)).toThrow('Invalid idempotency strategy');
    });

    it('should return the same instance on repeated calls (singleton)', () => {
      expect(factory.get('redis')).toBe(factory.get('redis'));
      expect(factory.get('durable')).toBe(factory.get('durable'));
    });
  });
});
