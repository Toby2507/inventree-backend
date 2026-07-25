import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { catchError, type Observable, tap, throwError } from 'rxjs';
import { getOptionalObservationContext } from '../context/observation-context.storage';
import { LOGGER, type Logger } from '../ports/logger.port';

@Injectable()
export class RequestLoggerInterceptor implements NestInterceptor {
  constructor(@Inject(LOGGER) private readonly logger: Logger) {}

  intercept(executionContext: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = executionContext.switchToHttp().getRequest<Request>();
    const ctx = getOptionalObservationContext();
    const startMs = performance.now();

    this.logger.log('Incoming request', {
      method: req.method,
      path: req.path,
      idempotencyKey: ctx?.idempotencyKey,
    });

    return next.handle().pipe(
      tap(() => {
        const res = executionContext.switchToHttp().getResponse();
        this.logger.log('Request completed', {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          durationMs: performance.now() - startMs,
        });
      }),
      catchError((err) => {
        this.logger.error('Request failed', {
          method: req.method,
          path: req.path,
          durationMs: performance.now() - startMs,
          errorMessage: err?.message,
          errorCode: err?.code,
        });
        return throwError(() => err);
      }),
    );
  }
}
