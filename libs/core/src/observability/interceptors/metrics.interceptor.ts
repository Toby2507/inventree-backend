import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { catchError, Observable, tap, throwError } from 'rxjs';
import { MetricNames } from '../metrics/metric-names';
import { METRICS, MetricsPort } from '../ports/metrics.port';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(@Inject(METRICS) private readonly metrics: MetricsPort) {}

  intercept(executionContext: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = executionContext.switchToHttp().getRequest<Request>();
    const startMs = performance.now();
    const method = req.method;
    const route = (req.route?.path as string | undefined) ?? req.path;

    this.metrics.adjust(MetricNames.HTTP_ACTIVE, 1, { method, route });

    return next.handle().pipe(
      tap(() => {
        const res = executionContext.switchToHttp().getResponse<Response>();
        const attrs = { method, route, status_code: String(res.statusCode) };
        this.metrics.record(MetricNames.HTTP_DURATION, performance.now() - startMs, attrs);
        this.metrics.increment(MetricNames.HTTP_TOTAL, attrs);
        this.metrics.adjust(MetricNames.HTTP_ACTIVE, -1, { method, route });
      }),
      catchError((err) => {
        const statusCode = err?.status ?? err?.statusCode ?? 500;
        const attrs = { method, route, status_code: String(statusCode) };
        this.metrics.record(MetricNames.HTTP_DURATION, performance.now() - startMs, attrs);
        this.metrics.increment(MetricNames.HTTP_TOTAL, attrs);
        this.metrics.adjust(MetricNames.HTTP_ACTIVE, -1, { method, route });
        return throwError(() => err);
      }),
    );
  }
}
