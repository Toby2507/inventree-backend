import { ApplicationException, DomainException, ExceptionCategory } from '@app/shared-kernel';
import { makeLoggerMock } from '@app/testing/core/observability';
import { makeHostMock } from '@app/testing/system';
import { HttpStatus } from '@nestjs/common';
import { LayerExceptionFilter } from './layer-exception.filter';

class ProductNotFoundException extends ApplicationException {
  readonly code = 'PRODUCT_NOT_FOUND';
  constructor() {
    super('Product not found');
  }

  get category(): ExceptionCategory {
    return ExceptionCategory.NOT_FOUND;
  }
}

class TransactionAlreadyCompletedException extends DomainException {
  readonly code = 'TRANSACTION_ALREADY_COMPLETED';
  constructor(context?: Record<string, unknown>) {
    super('Transaction is already completed', context);
  }
}

class UnknownCategoryException extends ApplicationException {
  readonly code = 'UNKNOWN_CATEGORY';
  constructor() {
    super('This exception has an unknown category');
  }

  get category(): ExceptionCategory {
    return 'SOME_FUTURE_CATEGORY' as unknown as ExceptionCategory;
  }
}

describe('LayerExceptionFilter', () => {
  let filter: LayerExceptionFilter;
  const { logger, contextLogger } = makeLoggerMock();

  beforeEach(() => {
    filter = new LayerExceptionFilter(logger);
  });

  describe('HTTP status mapping', () => {
    it('should set 404 for a NOT_FOUND exception category', () => {
      const { host, mockStatus } = makeHostMock();
      filter.catch(new ProductNotFoundException(), host);
      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    });

    it('should set 422 for a BUSINESS_RULE exception category', () => {
      const { host, mockStatus } = makeHostMock();
      filter.catch(new TransactionAlreadyCompletedException(), host);
      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    });

    it('should log an error for unhandled exception categories', () => {
      const { host } = makeHostMock();
      const exception = new UnknownCategoryException();
      filter.catch(exception, host);
      expect(contextLogger.error).toHaveBeenCalledWith(
        'Unhandled exception category: SOME_FUTURE_CATEGORY',
        { exception },
      );
    });
  });

  describe('response body', () => {
    it('should include statusCode, code, and message', () => {
      const { host, mockJson } = makeHostMock();
      filter.catch(new ProductNotFoundException(), host);
      expect(mockJson).toHaveBeenCalledWith({
        statusCode: HttpStatus.NOT_FOUND,
        code: 'PRODUCT_NOT_FOUND',
        message: 'Product not found',
      });
    });

    it('should never include context in the response body', () => {
      const { host, mockJson } = makeHostMock();
      const context = { transactionId: 'txn-123', storeId: 'store-456' };
      filter.catch(new TransactionAlreadyCompletedException(context), host);
      const [body] = mockJson.mock.calls[0];
      expect(body).not.toHaveProperty('context');
    });
  });
});
