import type { CallHandler } from '@nestjs/common';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import type { IdempotencyOptions } from '../decorators/idempotency.decorator';

export interface IdempotencyStrategy {
  handle<T>(request: Request, next: CallHandler, options: IdempotencyOptions): Observable<T>;
}
