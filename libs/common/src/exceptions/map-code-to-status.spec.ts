import { HttpStatus } from '@nestjs/common';
import { mapCodeToStatus } from './map-code-to-status';

describe('mapCodeToStatus', () => {
  describe('_NOT_FOUND suffix → 404', () => {
    it.each([
      'PRODUCT_NOT_FOUND',
      'STORE_MEMBER_NOT_FOUND',
      'TRANSACTION_NOT_FOUND',
      'PURCHASE_ORDER_NOT_FOUND',
    ])('%s', (code) => {
      expect(mapCodeToStatus(code)).toBe(HttpStatus.NOT_FOUND);
    });
  });

  describe('_ALREADY_EXISTS suffix → 409', () => {
    it.each([
      'STORE_MEMBER_ALREADY_EXISTS',
      'PRODUCT_ALREADY_EXISTS',
      'TERMINAL_CODE_ALREADY_EXISTS',
    ])('%s', (code) => {
      expect(mapCodeToStatus(code)).toBe(HttpStatus.CONFLICT);
    });
  });

  describe('_UNAUTHORIZED suffix → 401', () => {
    it.each(['ACTION_UNAUTHORIZED', 'OPERATION_UNAUTHORIZED'])('%s', (code) => {
      expect(mapCodeToStatus(code)).toBe(HttpStatus.UNAUTHORIZED);
    });
  });

  describe('_FORBIDDEN suffix → 403', () => {
    it.each(['ACTION_FORBIDDEN', 'STORE_ACCESS_FORBIDDEN'])('%s', (code) => {
      expect(mapCodeToStatus(code)).toBe(HttpStatus.FORBIDDEN);
    });
  });

  describe('all other codes → 422 (business rule violations)', () => {
    it.each([
      'TRANSACTION_ALREADY_COMPLETED',
      'TRANSACTION_ALREADY_VOIDED',
      'INSUFFICIENT_STOCK',
      'SESSION_NOT_OPEN',
      'INVALID_DISCOUNT_SCOPE',
      'STOCKTAKE_NOT_IN_PROGRESS',
      'PURCHASE_ORDER_NOT_APPROVABLE',
      'COMPLETELY_UNKNOWN_CODE',
    ])('%s', (code) => {
      expect(mapCodeToStatus(code)).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    });
  });
});
