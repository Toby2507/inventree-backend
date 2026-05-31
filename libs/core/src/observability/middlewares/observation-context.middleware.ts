import { Injectable, NestMiddleware } from '@nestjs/common';
import { context as otelCtx, propagation, ROOT_CONTEXT, trace } from '@opentelemetry/api';
import { NextFunction, Request, Response } from 'express';
import { v4 as uuidV4 } from 'uuid';
import { ObservationContext } from '../context/observation-context';
import { observationStorage } from '../context/observation-context.storage';
import { SpanAttributes } from '../tracing/span-attributes';

export const CORRELATION_HEADER = 'x-correlation-id';
export const IDEMPOTENCY_HEADER = 'x-idempotency-key';
export const CAUSATION_HEADER = 'x-causation-id';

@Injectable()
export class ObservationContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Restore OTEL context from upstream propagation headers
    const carrier: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') carrier[key] = value;
    }
    const extractedOtelCtx = propagation.extract(ROOT_CONTEXT, carrier);

    const correlationId = (req.headers[CORRELATION_HEADER] as string | undefined) ?? uuidV4();
    const causationId = req.headers[CAUSATION_HEADER] as string | undefined;
    const idempotencyKey = req.headers[IDEMPOTENCY_HEADER] as string | undefined;

    const activeSpan = trace.getSpan(otelCtx.active());
    activeSpan?.setAttributes({
      [SpanAttributes.CORRELATION_ID]: correlationId,
      ...(causationId ? { [SpanAttributes.CAUSATION_ID]: causationId } : {}),
    });

    res.setHeader(CORRELATION_HEADER, correlationId);
    const observationCtx: ObservationContext = {
      correlationId,
      causationId,
      idempotencyKey,
    };

    otelCtx.with(extractedOtelCtx, () => {
      observationStorage.run(observationCtx, () => next());
    });
  }
}
