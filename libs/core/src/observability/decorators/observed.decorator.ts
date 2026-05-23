import { AppLoggerService, ContextLogger } from '../logger';
import { Trace, TraceOptions } from './trace.decorator';

export interface ObservedOptions extends TraceOptions {
  logContext?: string;
  logArgs?: boolean;
  logResult?: boolean;
  redactArgKeys?: string[];
}

/**
 * `@Observed()` — method decorator.
 *
 * Automatically logs and traces execution of decorated method.
 * The class must expose `this.logger: AppLoggerService` (injected via DI).
 */
export function Observed(options: ObservedOptions = {}): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ) {
    const traced = descriptor.value as (...args: unknown[]) => Promise<unknown>;
    const className = target.constructor.name;
    const methodName = String(propertyKey);
    const logContext = options.logContext ?? `${className}.${methodName}`;

    Trace({ name: options.name ?? logContext, attributes: options.attributes })(
      target,
      propertyKey,
      descriptor,
    );

    descriptor.value = async function (...args: unknown[]) {
      const logger: AppLoggerService | undefined = (this as any).logger;
      const log: ContextLogger | undefined = logger?.forContext(logContext);
      const startMs = performance.now();

      log?.log(`${methodName} started`, {
        ...(options.logArgs ? { args: sanitizeArgs(args, options.redactArgKeys) } : {}),
      });

      try {
        const result = await traced.apply(this, args);
        log?.log(`${methodName} completed`, {
          durationMs: performance.now() - startMs,
          ...(options.logResult ? { result } : {}),
        });
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        log?.error(`${methodName} failed`, {
          durationMs: performance.now() - startMs,
          errorMessage: error.message,
          errorCode: (err as any)?.code,
        });
        throw err;
      }
    };

    return descriptor;
  };
}

function sanitizeArgs(args: unknown[], redactKeys: string[] = []): unknown[] {
  const defaultRedactKeys = ['password', 'passwordHash', 'token', 'secret', 'mfaSecret'];
  return args.map((arg) => {
    if (arg === null || arg === undefined) return arg;
    if (typeof arg === 'object') {
      const sanitized = { ...(arg as Record<string, unknown>) };
      for (const key of [...defaultRedactKeys, ...redactKeys]) {
        if (key in sanitized) sanitized[key] = '[REDACTED]';
      }
      return sanitized;
    }
    return arg;
  });
}
