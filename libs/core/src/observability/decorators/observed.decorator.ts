import { LoggerPort } from '../ports';
import { Trace, TraceOptions } from './trace.decorator';

type LoggableInstance = { logger?: LoggerPort };
export interface ObservedOptions extends TraceOptions {
  logContext?: string;
  logArgs?: boolean;
  logResult?: boolean;
  redactArgKeys?: string[];
  redactResultKeys?: string[];
}

const isDev = process.env.NODE_ENV !== 'production';

/**
 * `@Observed()` — method decorator.
 *
 * Automatically logs and traces execution of decorated method.
 * The class must expose `this.logger: LoggerPort` (injected via DI).
 */
export function Observed(options: ObservedOptions = {}): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ) {
    const original = descriptor.value as (...args: unknown[]) => Promise<unknown>;
    const className = target.constructor.name;
    const methodName = String(propertyKey);
    const logContext = options.logContext ?? `${className}.${methodName}`;

    descriptor.value = async function (...args: unknown[]) {
      const logger = (this as LoggableInstance).logger;
      if (!logger && isDev) {
        console.warn(
          `[Observed] logger missing on ${className}, cannot log ${methodName} execution. Please inject Logger and add "public logger: LoggerPort" to the class.`,
        );
      }
      const log = logger?.forContext(logContext);
      const startMs = performance.now();

      log?.log(`started`, {
        ...(options.logArgs ? { args: sanitizeArgs(args, options.redactArgKeys) } : {}),
      });

      try {
        const result = await original.apply(this, args);
        log?.log(`completed`, {
          durationMs: performance.now() - startMs,
          ...(options.logResult
            ? { result: sanitizeResult(result, options.redactResultKeys) }
            : {}),
        });
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        log?.error(`failed`, {
          durationMs: performance.now() - startMs,
          errorMessage: error.message,
          errorCode: (err as any)?.code,
        });
        throw err;
      }
    };

    Trace({ name: options.name ?? logContext, attributes: options.attributes })(
      target,
      propertyKey,
      descriptor,
    );

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

function sanitizeResult(result: unknown, redactKeys: string[] = []): unknown {
  if (result === null || result === undefined) return result;
  if (typeof result === 'object') {
    const sanitized = { ...(result as Record<string, unknown>) };
    for (const key of redactKeys) {
      if (key in sanitized) sanitized[key] = '[REDACTED]';
    }
    return sanitized;
  }
  return result;
}
