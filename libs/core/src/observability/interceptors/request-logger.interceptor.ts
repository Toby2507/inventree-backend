import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { getOptionalObservationContext } from '../context';
import { AppLoggerService } from '../logger';

@Injectable()
export class RequestLoggerInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLoggerService) {}

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
