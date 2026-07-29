export const EXCEPTION_CATEGORIES = {
  VALIDATION: 'validation',
  NOT_FOUND: 'not_found',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  CONFLICT: 'conflict',
  BUSINESS_RULE: 'business_rule',
  INTERNAL: 'internal',
} as const;

export type ExceptionCategory = (typeof EXCEPTION_CATEGORIES)[keyof typeof EXCEPTION_CATEGORIES];
