import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { catchError, type Observable, tap, throwError } from 'rxjs';
import { METRIC_NAMES } from '../metrics/metric-names';
import { METRICS, type Metrics } from '../ports/metrics.port';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(@Inject(METRICS) private readonly metrics: Metrics) {}

  intercept(executionContext: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = executionContext.switchToHttp().getRequest<Request>();
    const startMs = performance.now();
    const method = req.method;
    const route = (req.route?.path as string | undefined) ?? req.path;

    this.metrics.adjust(METRIC_NAMES.HTTP_ACTIVE, 1, { method, route });

    return next.handle().pipe(
      tap(() => {
        const res = executionContext.switchToHttp().getResponse<Response>();
        const attrs = { method, route, status_code: String(res.statusCode) };
        this.metrics.record(METRIC_NAMES.HTTP_DURATION, performance.now() - startMs, attrs);
        this.metrics.increment(METRIC_NAMES.HTTP_TOTAL, attrs);
        this.metrics.adjust(METRIC_NAMES.HTTP_ACTIVE, -1, { method, route });
      }),
      catchError((err) => {
        const statusCode = err?.status ?? err?.statusCode ?? 500;
        const attrs = { method, route, status_code: String(statusCode) };
        this.metrics.record(METRIC_NAMES.HTTP_DURATION, performance.now() - startMs, attrs);
        this.metrics.increment(METRIC_NAMES.HTTP_TOTAL, attrs);
        this.metrics.adjust(METRIC_NAMES.HTTP_ACTIVE, -1, { method, route });
        return throwError(() => err);
      }),
    );
  }
}
