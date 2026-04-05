import { HttpStatus } from '@nestjs/common';

/**
 * Maps a domain exception code to an HTTP status code using convention-based
 * suffix matching. Domain exception authors must follow the naming convention
 * for automatic mapping to work correctly.
 *
 * Suffix rules (evaluated in order):
 *   - *_INVALID        → 400 Bad Request
 *   - *_NOT_FOUND      → 404 Not Found
 *   - *_ALREADY_EXISTS → 409 Conflict
 *   - *_UNAUTHORIZED   → 401 Unauthorized
 *   - *_FORBIDDEN      → 403 Forbidden
 *
 * All other codes default to 422 Unprocessable Entity — the correct status
 * for business rule violations (e.g. TRANSACTION_ALREADY_COMPLETED,
 * INSUFFICIENT_STOCK, SESSION_NOT_OPEN).
 *
 * If an unexpected code returns 422, add an explicit suffix rule here rather
 * than hardcoding individual codes — keep this function convention-driven.
 */
export function mapCodeToStatus(code: string): HttpStatus {
  if (code.endsWith('_INVALID')) return HttpStatus.BAD_REQUEST;
  if (code.endsWith('_NOT_FOUND')) return HttpStatus.NOT_FOUND;
  if (code.endsWith('_ALREADY_EXISTS')) return HttpStatus.CONFLICT;
  if (code.endsWith('_UNAUTHORIZED')) return HttpStatus.UNAUTHORIZED;
  if (code.endsWith('_FORBIDDEN')) return HttpStatus.FORBIDDEN;
  return HttpStatus.UNPROCESSABLE_ENTITY;
}
