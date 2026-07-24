import { ExceptionCategory } from '@app/shared-kernel';
import { HttpStatus } from '@nestjs/common';
import { mapExceptionCategoryToStatus } from './map-exception-category-to-status';

describe('mapExceptionCategoryToStatus', () => {
  it.each([
    [ExceptionCategory.VALIDATION, HttpStatus.BAD_REQUEST],
    [ExceptionCategory.NOT_FOUND, HttpStatus.NOT_FOUND],
    [ExceptionCategory.UNAUTHORIZED, HttpStatus.UNAUTHORIZED],
    [ExceptionCategory.FORBIDDEN, HttpStatus.FORBIDDEN],
    [ExceptionCategory.CONFLICT, HttpStatus.CONFLICT],
    [ExceptionCategory.BUSINESS_RULE, HttpStatus.UNPROCESSABLE_ENTITY],
    [ExceptionCategory.INTERNAL, HttpStatus.INTERNAL_SERVER_ERROR],
  ])('should map %s to %s', (category, expectedStatus) => {
    expect(mapExceptionCategoryToStatus(category)).toBe(expectedStatus);
  });

  it('should fall back to INTERNAL_SERVER_ERROR for an unrecognized category', () => {
    const unknownCategory = 'SOME_FUTURE_CATEGORY' as unknown as ExceptionCategory;
    expect(mapExceptionCategoryToStatus(unknownCategory)).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('should have an explicit case for every current ExceptionCategory member (no silent default fallback)', () => {
    const allCategories = Object.values(ExceptionCategory) as ExceptionCategory[];
    const statusesFromDefaultFallback = HttpStatus.INTERNAL_SERVER_ERROR;
    const unexpectedlyDefaulted = allCategories.filter((category) => {
      if (category === ExceptionCategory.INTERNAL) return false;
      return mapExceptionCategoryToStatus(category) === statusesFromDefaultFallback;
    });
    expect(unexpectedlyDefaulted).toEqual([]);
  });

  it('always returns a value from the HttpStatus enum', () => {
    const allCategories = Object.values(ExceptionCategory) as ExceptionCategory[];
    const validStatuses = Object.values(HttpStatus);
    for (const category of allCategories) {
      expect(validStatuses).toContain(mapExceptionCategoryToStatus(category));
    }
  });
});
