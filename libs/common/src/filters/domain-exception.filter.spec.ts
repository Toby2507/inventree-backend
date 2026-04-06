import { makeHost } from '@app/testing';
import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../exceptions';
import { DomainExceptionFilter } from './domain-exception.filter';

class ProductNotFoundException extends DomainException {
  readonly code = 'PRODUCT_NOT_FOUND';
  constructor() {
    super('Product not found');
  }
}

class TransactionAlreadyCompletedException extends DomainException {
  readonly code = 'TRANSACTION_ALREADY_COMPLETED';
  constructor(context?: Record<string, unknown>) {
    super('Transaction is already completed', context);
  }
}

describe('DomainExceptionFilter', () => {
  let filter: DomainExceptionFilter;

  beforeEach(() => {
    filter = new DomainExceptionFilter();
  });

  describe('HTTP status mapping', () => {
    it('sets 404 for a _NOT_FOUND exception', () => {
      const { host, mockStatus } = makeHost();
      filter.catch(new ProductNotFoundException(), host);
      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    });

    it('sets 422 for a business rule violation', () => {
      const { host, mockStatus } = makeHost();
      filter.catch(new TransactionAlreadyCompletedException(), host);
      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    });
  });

  describe('response body', () => {
    it('includes statusCode, code, and message', () => {
      const { host, mockJson } = makeHost();
      filter.catch(new ProductNotFoundException(), host);
      expect(mockJson).toHaveBeenCalledWith({
        statusCode: HttpStatus.NOT_FOUND,
        code: 'PRODUCT_NOT_FOUND',
        message: 'Product not found',
      });
    });

    it('never includes context in the response body', () => {
      const { host, mockJson } = makeHost();
      const context = { transactionId: 'txn-123', storeId: 'store-456' };
      filter.catch(new TransactionAlreadyCompletedException(context), host);
      const [body] = mockJson.mock.calls[0];
      expect(body).not.toHaveProperty('context');
    });
  });
});
