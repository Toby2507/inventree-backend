import { EXCEPTION_CATEGORIES, type ExceptionCategory } from '@app/shared-kernel';
import { HttpStatus } from '@nestjs/common';
import { mapExceptionCategoryToStatus } from './map-exception-category-to-status';

describe('mapExceptionCategoryToStatus', () => {
  it.each([
    [EXCEPTION_CATEGORIES.VALIDATION, HttpStatus.BAD_REQUEST],
    [EXCEPTION_CATEGORIES.NOT_FOUND, HttpStatus.NOT_FOUND],
    [EXCEPTION_CATEGORIES.UNAUTHORIZED, HttpStatus.UNAUTHORIZED],
    [EXCEPTION_CATEGORIES.FORBIDDEN, HttpStatus.FORBIDDEN],
    [EXCEPTION_CATEGORIES.CONFLICT, HttpStatus.CONFLICT],
    [EXCEPTION_CATEGORIES.BUSINESS_RULE, HttpStatus.UNPROCESSABLE_ENTITY],
    [EXCEPTION_CATEGORIES.INTERNAL, HttpStatus.INTERNAL_SERVER_ERROR],
  ])('should map %s to %s', (category, expectedStatus) => {
    expect(mapExceptionCategoryToStatus(category)).toBe(expectedStatus);
  });

  it('should fall back to INTERNAL_SERVER_ERROR for an unrecognized category', () => {
    const unknownCategory = 'SOME_FUTURE_CATEGORY' as unknown as ExceptionCategory;
    expect(mapExceptionCategoryToStatus(unknownCategory)).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('should have an explicit case for every current ExceptionCategory member (no silent default fallback)', () => {
    const allCategories = Object.values(EXCEPTION_CATEGORIES) as ExceptionCategory[];
    const statusesFromDefaultFallback = HttpStatus.INTERNAL_SERVER_ERROR;
    const unexpectedlyDefaulted = allCategories.filter((category) => {
      if (category === EXCEPTION_CATEGORIES.INTERNAL) return false;
      return mapExceptionCategoryToStatus(category) === statusesFromDefaultFallback;
    });
    expect(unexpectedlyDefaulted).toEqual([]);
  });

  it('always returns a value from the HttpStatus enum', () => {
    const allCategories = Object.values(EXCEPTION_CATEGORIES) as ExceptionCategory[];
    const validStatuses = Object.values(HttpStatus);
    for (const category of allCategories) {
      expect(validStatuses).toContain(mapExceptionCategoryToStatus(category));
    }
  });
});
