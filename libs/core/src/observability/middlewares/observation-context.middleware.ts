import {
  CAUSATION_HEADER,
  CORRELATION_HEADER,
  IDEMPOTENCY_HEADER,
} from '@app/framework/nest/constants';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import { context as otelCtx, propagation, ROOT_CONTEXT, trace } from '@opentelemetry/api';
import type { NextFunction, Request, Response } from 'express';
import { v4 as uuidV4 } from 'uuid';
import type { ObservationContext } from '../context/observation-context';
import { observationStorage } from '../context/observation-context.storage';
import { SPAN_ATTRIBUTES } from '../tracing/span-attributes';

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
      [SPAN_ATTRIBUTES.CORRELATION_ID]: correlationId,
      ...(causationId ? { [SPAN_ATTRIBUTES.CAUSATION_ID]: causationId } : {}),
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
