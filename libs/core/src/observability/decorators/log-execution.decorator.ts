import { copyMethodMetadata } from '@app/common';
import { LoggerPort } from '../ports';

type LoggableInstance = { logger?: LoggerPort };

const isDev = process.env.NODE_ENV !== 'production';

/**
 * `@LogExecution()` — method decorator.
 * LOG_LEVEL env needs to be set to debug to get the output from this
 *
 * Automatically logs the execution of the decorated method.
 * The class must expose `this.logger: LoggerPort` (injected via DI).
 */
export function LogExecution(contextOverride?: string): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ) {
    const original = descriptor.value as (...args: unknown[]) => Promise<unknown>;
    const className = target.constructor.name;
    const methodName = String(propertyKey);
    const logContext = contextOverride ?? `${className}.${methodName}`;

    descriptor.value = async function (...args: unknown[]) {
      const logger = (this as LoggableInstance).logger;
      if (!logger && isDev) {
        console.warn(
          `[LogExecution] logger missing on ${className}, cannot log ${methodName} execution. Please inject Logger and add "public logger: LoggerPort" to the class.`,
        );
      }
      const log = logger?.forContext(logContext);
      const startMs = performance.now();

      try {
        const result = await original.apply(this, args);
        log?.debug(`completed`, { durationMs: performance.now() - startMs });
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        log?.error(`failed`, {
          durationMs: performance.now() - startMs,
          errorMessage: error.message,
        });
        throw err;
      }
    };

    copyMethodMetadata(original, descriptor.value);
    return descriptor;
  };
}
