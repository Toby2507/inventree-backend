import { DomainException } from './domain.exception';

class TestException extends DomainException {
  readonly code = 'TEST_ERROR';

  constructor(context?: Record<string, unknown>) {
    super('Something went wrong', context);
  }
}

class AnotherException extends DomainException {
  readonly code = 'ANOTHER_ERROR';

  constructor() {
    super('Another error occurred');
  }
}

describe('DomainException', () => {
  describe('message', () => {
    it('sets message from constructor', () => {
      const err = new TestException();
      expect(err.message).toBe('Something went wrong');
    });
  });

  describe('name', () => {
    it('sets name to the subclass constructor name', () => {
      expect(new TestException().name).toBe('TestException');
      expect(new AnotherException().name).toBe('AnotherException');
    });
  });

  describe('code', () => {
    it('exposes the subclass-declared code', () => {
      expect(new TestException().code).toBe('TEST_ERROR');
      expect(new AnotherException().code).toBe('ANOTHER_ERROR');
    });
  });

  describe('context', () => {
    it('is undefined when not provided', () => {
      expect(new TestException().context).toBeUndefined();
    });

    it('stores context when provided', () => {
      const ctx = { orderId: 'abc-123', storeId: 'xyz' };
      expect(new TestException(ctx).context).toEqual(ctx);
    });
  });

  describe('instanceof', () => {
    it('satisfies instanceof Error', () => {
      expect(new TestException()).toBeInstanceOf(Error);
    });

    it('satisfies instanceof DomainException', () => {
      expect(new TestException()).toBeInstanceOf(DomainException);
    });

    it('satisfies instanceof the concrete subclass', () => {
      expect(new TestException()).toBeInstanceOf(TestException);
    });

    it('does not satisfy instanceof a sibling subclass', () => {
      expect(new TestException()).not.toBeInstanceOf(AnotherException);
    });
  });
});
