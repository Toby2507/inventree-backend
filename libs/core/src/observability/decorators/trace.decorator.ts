import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { getOptionalObservationContext } from '../context';
import { INVENTREE_TRACER, SpanAttributes } from '../tracing';

export interface TraceOptions {
  name?: string;
  attributes?: Record<string, string>;
}

export function Trace(options: TraceOptions = {}): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ) {
    const original = descriptor.value as (...args: unknown[]) => Promise<unknown>;
    const className = target.constructor.name;
    const spanName = options.name ?? `${className}.${String(propertyKey)}`;

    descriptor.value = async function (...args: unknown[]) {
      const tracer = trace.getTracer(INVENTREE_TRACER);
      const ctx = getOptionalObservationContext();

      return tracer.startActiveSpan(
        spanName,
        {
          kind: SpanKind.INTERNAL,
          attributes: {
            ...(ctx ? { [SpanAttributes.CORRELATION_ID]: ctx.correlationId } : {}),
            ...(ctx?.causationId ? { [SpanAttributes.CAUSATION_ID]: ctx.causationId } : {}),
            ...(ctx?.actor?.userId ? { [SpanAttributes.ACTOR_USER_ID]: ctx.actor.userId } : {}),
            ...(ctx?.actor?.storeId ? { [SpanAttributes.ACTOR_STORE_ID]: ctx.actor.storeId } : {}),
            ...options.attributes,
          },
        },
        async (span) => {
          try {
            const result = await original.apply(this, args);
            span.setStatus({ code: SpanStatusCode.OK });
            return result;
          } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            span.recordException(error);
            span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
            throw err;
          } finally {
            span.end();
          }
        },
      );
    };

    return descriptor;
  };
}
