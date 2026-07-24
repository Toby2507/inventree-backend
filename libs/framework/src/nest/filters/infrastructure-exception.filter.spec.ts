import { ExceptionCategory, InfrastructureException } from '@app/shared-kernel';
import { makeLoggerMock } from '@app/testing/core/observability';
import { makeHostMock } from '@app/testing/system';
import { HttpStatus } from '@nestjs/common';
import { InfrastructureExceptionFilter } from './infrastructure-exception.filter';

class OptimisticConcurrencyException extends InfrastructureException {
  readonly code = 'OPTIMISTIC_CONCURRENCY';
  constructor() {
    super('Update failed due to optimistic concurrency control');
  }
}

class OverridenCategoryException extends InfrastructureException {
  readonly code = 'OVERRIDEN_CATEGORY';
  constructor() {
    super('This exception has an overriden category');
  }

  get category(): ExceptionCategory {
    return ExceptionCategory.BUSINESS_RULE;
  }
}

describe('InfrastructureExceptionFilter', () => {
  let filter: InfrastructureExceptionFilter;
  const { logger, contextLogger } = makeLoggerMock();

  beforeEach(() => {
    filter = new InfrastructureExceptionFilter(logger);
  });

  it('should set 500 for infrastructure exception without an overriden category', () => {
    const { host, mockStatus } = makeHostMock();
    filter.catch(new OptimisticConcurrencyException(), host);
    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('should set 500 even if exception category is not INTERNAL', () => {
    const { host, mockStatus } = makeHostMock();
    filter.catch(new OverridenCategoryException(), host);
    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('should log the actual error message and stack trace', () => {
    const { host } = makeHostMock();
    const exception = new OptimisticConcurrencyException();
    filter.catch(exception, host);
    expect(contextLogger.error).toHaveBeenCalledWith(
      'Update failed due to optimistic concurrency control',
      { exception, stack: exception.stack },
    );
  });

  it('should always return the same message in the response body', () => {
    const { host, mockJson } = makeHostMock();
    filter.catch(new OptimisticConcurrencyException(), host);
    expect(mockJson).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'OPTIMISTIC_CONCURRENCY',
      message: 'An unexpected error occurred. Please try again later.',
    });
  });
});
