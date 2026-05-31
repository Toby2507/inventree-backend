type LogMeta = Record<string, unknown>;

export interface ContextLoggerPort {
  log(message: string, meta: Record<string, unknown>): void;
  error(message: string, meta: Record<string, unknown>): void;
  warn(message: string, meta: Record<string, unknown>): void;
  debug(message: string, meta: Record<string, unknown>): void;
}

export interface LoggerPort {
  log(message: string, meta?: LogMeta | string): void;
  error(message: string, meta?: LogMeta | string): void;
  warn(message: string, meta?: LogMeta | string): void;
  debug(message: string, meta?: LogMeta | string): void;
  verbose(message: string, meta?: LogMeta | string): void;
  forContext(contextName: string): ContextLoggerPort;
}

export const LOGGER = Symbol('LOGGER');
