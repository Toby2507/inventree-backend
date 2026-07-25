import { EXCEPTION_CATEGORIES, type ExceptionCategory } from '@app/shared-kernel';
import { HttpStatus } from '@nestjs/common';

export const mapExceptionCategoryToStatus = (category: ExceptionCategory): HttpStatus => {
  switch (category) {
    case EXCEPTION_CATEGORIES.VALIDATION:
      return HttpStatus.BAD_REQUEST;
    case EXCEPTION_CATEGORIES.NOT_FOUND:
      return HttpStatus.NOT_FOUND;
    case EXCEPTION_CATEGORIES.UNAUTHORIZED:
      return HttpStatus.UNAUTHORIZED;
    case EXCEPTION_CATEGORIES.FORBIDDEN:
      return HttpStatus.FORBIDDEN;
    case EXCEPTION_CATEGORIES.CONFLICT:
      return HttpStatus.CONFLICT;
    case EXCEPTION_CATEGORIES.BUSINESS_RULE:
      return HttpStatus.UNPROCESSABLE_ENTITY;
    case EXCEPTION_CATEGORIES.INTERNAL:
      return HttpStatus.INTERNAL_SERVER_ERROR;
    default:
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _exhaustiveCheck: never = category;
      return HttpStatus.INTERNAL_SERVER_ERROR;
  }
};
