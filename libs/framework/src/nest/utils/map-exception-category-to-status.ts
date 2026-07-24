import { ExceptionCategory } from '@app/shared-kernel';
import { HttpStatus } from '@nestjs/common';

export const mapExceptionCategoryToStatus = (category: ExceptionCategory): HttpStatus => {
  switch (category) {
    case ExceptionCategory.VALIDATION:
      return HttpStatus.BAD_REQUEST;
    case ExceptionCategory.NOT_FOUND:
      return HttpStatus.NOT_FOUND;
    case ExceptionCategory.UNAUTHORIZED:
      return HttpStatus.UNAUTHORIZED;
    case ExceptionCategory.FORBIDDEN:
      return HttpStatus.FORBIDDEN;
    case ExceptionCategory.CONFLICT:
      return HttpStatus.CONFLICT;
    case ExceptionCategory.BUSINESS_RULE:
      return HttpStatus.UNPROCESSABLE_ENTITY;
    case ExceptionCategory.INTERNAL:
      return HttpStatus.INTERNAL_SERVER_ERROR;
    default:
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _exhaustiveCheck: never = category;
      return HttpStatus.INTERNAL_SERVER_ERROR;
  }
};
