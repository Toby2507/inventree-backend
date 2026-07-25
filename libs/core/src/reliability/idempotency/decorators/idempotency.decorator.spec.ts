import { IDEMPOTENCY_KEY, type IdempotencyOptions, Idempotent } from './idempotency.decorator';

describe('Idempotent', () => {
  it('should attach idempotency metadata', () => {
    const options: IdempotencyOptions = { strategy: 'redis', scope: 'test', ttlSeconds: 300 };
    class TestController {
      @Idempotent(options)
      testMethod() {}
    }
    const metadata = Reflect.getMetadata(IDEMPOTENCY_KEY, TestController.prototype.testMethod);
    expect(metadata).toEqual(options);
  });
});
