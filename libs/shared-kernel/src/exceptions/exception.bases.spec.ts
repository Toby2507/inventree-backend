import { ApplicationException, DomainException, InfrastructureException } from './exception.bases';
import { EXCEPTION_CATEGORIES, type ExceptionCategory } from './exception.enum';

class TestDomainError extends DomainException {
  readonly code = 'TEST_DOMAIN_ERROR';
}

class TestDomainErrorWithContext extends DomainException {
  readonly code = 'TEST_DOMAIN_ERROR_WITH_CONTEXT';
}

class TestApplicationError extends ApplicationException {
  readonly code = 'TEST_APPLICATION_ERROR';
  get category(): ExceptionCategory {
    return EXCEPTION_CATEGORIES.VALIDATION;
  }
}

class TestInfrastructureError extends InfrastructureException {
  readonly code = 'TEST_INFRASTRUCTURE_ERROR';
}

class SpecificDomainError extends TestDomainError {}

describe('ExceptionBase (via concrete subclasses)', () => {
  it('should be a real Error instance', () => {
    const err = new TestDomainError('something went wrong');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('something went wrong');
  });

  it('should set name to the subclass constructor name, not the abstract base name', () => {
    const domainErr = new TestDomainError('msg');
    const appErr = new TestApplicationError('msg');
    const infraErr = new TestInfrastructureError('msg');
    const specificDomainErr = new SpecificDomainError('msg');
    expect(domainErr.name).toBe('TestDomainError');
    expect(appErr.name).toBe('TestApplicationError');
    expect(infraErr.name).toBe('TestInfrastructureError');
    expect(specificDomainErr.name).toBe('SpecificDomainError');
  });

  it('should leave context undefined when none is provided', () => {
    const err = new TestDomainError('msg');
    expect(err.context).toBeUndefined();
  });

  it('should store the context object when provided', () => {
    const context = { userId: 'u1', attempt: 3 };
    const err = new TestDomainErrorWithContext('msg', context);
    expect(err.context).toEqual(context);
  });

  it('should produce a usable stack trace', () => {
    const err = new TestDomainError('msg');
    expect(typeof err.stack).toBe('string');
    expect(err.stack).toContain('TestDomainError');
  });

  it('should maintain the prototype chain through instanceof at every inheritance level', () => {
    const err = new SpecificDomainError('msg');
    expect(err).toBeInstanceOf(SpecificDomainError);
    expect(err).toBeInstanceOf(TestDomainError);
    expect(err).toBeInstanceOf(DomainException);
    expect(err).toBeInstanceOf(Error);
  });

  it('should keep distinct instances/messages independent of one another', () => {
    const first = new TestDomainError('first', { a: 1 });
    const second = new TestDomainError('second', { a: 2 });
    expect(first.message).toBe('first');
    expect(second.message).toBe('second');
    expect(first.context).toEqual({ a: 1 });
    expect(second.context).toEqual({ a: 2 });
  });
});

describe('DomainException', () => {
  it('should always report category BUSINESS_RULE regardless of the concrete subclass', () => {
    const err = new TestDomainError('msg');
    expect(err.category).toBe(EXCEPTION_CATEGORIES.BUSINESS_RULE);
  });

  it('should require each concrete subclass to define its own code', () => {
    const err = new TestDomainError('msg');
    expect(err.code).toBe('TEST_DOMAIN_ERROR');
  });

  it('should itself be an instance of DomainException and ExceptionBase/Error', () => {
    const err = new TestDomainError('msg');
    expect(err).toBeInstanceOf(DomainException);
    expect(err).toBeInstanceOf(Error);
  });
});

describe('ApplicationException', () => {
  it('should delegate category() to the concrete subclass implementation', () => {
    const err = new TestApplicationError('msg');
    expect(err.category).toBe(EXCEPTION_CATEGORIES.VALIDATION);
  });

  it('should carry its own code independent of category', () => {
    const err = new TestApplicationError('msg');
    expect(err.code).toBe('TEST_APPLICATION_ERROR');
  });

  it('should be an instance of ApplicationException and Error', () => {
    const err = new TestApplicationError('msg');
    expect(err).toBeInstanceOf(ApplicationException);
    expect(err).toBeInstanceOf(Error);
  });
});

describe('InfrastructureException', () => {
  it('should always report category INTERNAL regardless of the concrete subclass', () => {
    const err = new TestInfrastructureError('msg');
    expect(err.category).toBe(EXCEPTION_CATEGORIES.INTERNAL);
  });

  it('should require each concrete subclass to define its own code', () => {
    const err = new TestInfrastructureError('msg');
    expect(err.code).toBe('TEST_INFRASTRUCTURE_ERROR');
  });

  it('should be an instance of InfrastructureException and Error', () => {
    const err = new TestInfrastructureError('msg');
    expect(err).toBeInstanceOf(InfrastructureException);
    expect(err).toBeInstanceOf(Error);
  });
});

describe('cross-layer isolation', () => {
  it('should not cross-classify instances between the three layer bases', () => {
    const domainErr = new TestDomainError('msg');
    const appErr = new TestApplicationError('msg');
    const infraErr = new TestInfrastructureError('msg');

    expect(domainErr).not.toBeInstanceOf(ApplicationException);
    expect(domainErr).not.toBeInstanceOf(InfrastructureException);

    expect(appErr).not.toBeInstanceOf(DomainException);
    expect(appErr).not.toBeInstanceOf(InfrastructureException);

    expect(infraErr).not.toBeInstanceOf(DomainException);
    expect(infraErr).not.toBeInstanceOf(ApplicationException);
  });

  it('should give each layer its own default/derived category independent of the others', () => {
    const domainErr = new TestDomainError('msg');
    const infraErr = new TestInfrastructureError('msg');

    expect(domainErr.category).not.toBe(infraErr.category);
  });
});
