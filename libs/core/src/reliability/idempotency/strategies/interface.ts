import { CallHandler } from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { IdempotencyOptions } from '../decorators/idempotency.decorator';

export interface IdempotencyStrategy {
  handle<T>(request: Request, next: CallHandler, options: IdempotencyOptions): Observable<T>;
}
