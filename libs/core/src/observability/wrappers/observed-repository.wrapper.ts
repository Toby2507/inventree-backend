import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { getOptionalObservationContext } from '../context/observation-context.storage';
import type { Logger } from '../ports/logger.port';
import { SPAN_ATTRIBUTES } from '../tracing/span-attributes';
import { INVENTREE_TRACER } from '../tracing/tracer.provider';

/**
 * Wraps a Kysely repository with automatic span creation and logging.
 *
 * Business logic injects the raw repository. The wrapper is bound in the
 * infrastructure module, so the domain layer never sees observability code.
 *
 * Usage in IdentityDomainModule:
 * ```
 *   {
 *     provide: USER_REPOSITORY,
 *     useFactory: (raw: UserKyselyRepository, logger: Logger) =>
 *       new ObservedRepositoryWrapper(raw, 'user', logger),
 *     inject: [UserKyselyRepository, LOGGER],
 *   }
 * ```
 */
export class ObservedRepositoryWrapper<T extends object> {
  private readonly logger;

  constructor(
    private readonly repository: T,
    private readonly entityName: string,
    logger: Logger,
  ) {
    this.logger = logger.forContext(`Repository.${entityName}`);

    // Return a Proxy so every method call goes through our wrapper
    return new Proxy(this, {
      get(target, prop) {
        const value = (repository as any)[prop];
        if (typeof value !== 'function') return value;

        return async (...args: unknown[]) => {
          return target.wrapMethod(String(prop), () => value.apply(repository, args));
        };
      },
    }) as unknown as ObservedRepositoryWrapper<T> & T;
  }

  private async wrapMethod<R>(operation: string, fn: () => Promise<R>): Promise<R> {
    const tracer = trace.getTracer(INVENTREE_TRACER);
    const ctx = getOptionalObservationContext();
    const startMs = performance.now();

    return tracer.startActiveSpan(
      `aggregate.persistence.${this.entityName}.${operation}`,
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          [SPAN_ATTRIBUTES.REPOSITORY_ENTITY]: this.entityName,
          [SPAN_ATTRIBUTES.REPOSITORY_OPERATION]: operation,
          ...(ctx ? { [SPAN_ATTRIBUTES.CORRELATION_ID]: ctx.correlationId } : {}),
        },
      },
      async (span) => {
        try {
          const result = await fn();
          span.setStatus({ code: SpanStatusCode.OK });
          this.logger.debug(`${operation} ok`, { durationMs: performance.now() - startMs });
          return result;
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          span.recordException(error);
          span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
          this.logger.error(`${operation} failed`, {
            durationMs: performance.now() - startMs,
            errorMessage: error.message,
          });
          throw err;
        } finally {
          span.end();
        }
      },
    );
  }
}
