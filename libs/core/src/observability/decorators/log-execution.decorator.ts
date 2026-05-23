import { AppLoggerService } from '../logger';

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
      const logger: AppLoggerService | undefined = (this as any).logger;
      const log = logger?.forContext(logContext);
      const startMs = performance.now();

      try {
        const result = await original.apply(this, args);
        log?.debug(`${methodName} ok`, { durationMs: performance.now() - startMs });
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        log?.error(`${methodName} failed`, {
          durationMs: performance.now() - startMs,
          errorMessage: error.message,
        });
        throw err;
      }
    };

    return descriptor;
  };
}
