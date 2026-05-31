import {
  context as otelCtx,
  propagation,
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';
import { v4 as uuidV4 } from 'uuid';
import { INVENTREE_TRACER, SpanAttributes } from '../tracing';
import { ObservationContext, SerializedOutboxContext } from './observation-context';
import { observationStorage } from './observation-context.storage';

export interface RestoredContextOptions {
  spanName: string;
  spanKind?: SpanKind;
  spanAttributes?: Record<string, string | number>;
}

export async function withRestoredObservationContext<T>(
  serialized: SerializedOutboxContext | null | undefined,
  options: RestoredContextOptions,
  fn: () => Promise<T>,
): Promise<T> {
  const obs: SerializedOutboxContext = serialized ?? {
    correlationId: uuidV4(),
  };
  const restoredOtelCtx = obs.traceparent
    ? propagation.extract(ROOT_CONTEXT, {
        traceparent: obs.traceparent,
        tracestate: obs.tracestate,
      })
    : ROOT_CONTEXT;

  return new Promise<T>((resolve, reject) => {
    otelCtx.with(restoredOtelCtx, () => {
      const tracer = trace.getTracer(INVENTREE_TRACER);

      tracer.startActiveSpan(
        options.spanName,
        {
          kind: options.spanKind ?? SpanKind.CONSUMER,
          attributes: {
            [SpanAttributes.CORRELATION_ID]: obs.correlationId,
            ...(obs.causationId ? { [SpanAttributes.CAUSATION_ID]: obs.causationId } : {}),
            ...(obs.actorUserId ? { [SpanAttributes.ACTOR_USER_ID]: obs.actorUserId } : {}),
            ...(obs.actorStoreId ? { [SpanAttributes.ACTOR_STORE_ID]: obs.actorStoreId } : {}),
            ...options.spanAttributes,
          },
        },
        async (span) => {
          const observationCtx: ObservationContext = {
            correlationId: obs.correlationId,
            causationId: obs.causationId,
            idempotencyKey: obs.idempotencyKey,
            actor: obs.actorUserId
              ? {
                  userId: obs.actorUserId,
                  storeId: obs.actorStoreId ?? '',
                  role: obs.actorRole ?? '',
                }
              : undefined,
          };

          observationStorage.run(observationCtx, async () => {
            try {
              const result = await fn();
              span.setStatus({ code: SpanStatusCode.OK });
              resolve(result);
            } catch (err) {
              const error = err instanceof Error ? err : new Error(String(err));
              span.recordException(error);
              span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
              reject(err);
            } finally {
              span.end();
            }
          });
        },
      );
    });
  });
}
