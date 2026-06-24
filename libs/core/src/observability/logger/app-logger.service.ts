import { OBSERVABILITY_CONFIG, ObservabilityConfig } from '@app/config';
import { Inject, Injectable, LoggerService } from '@nestjs/common';
import pino, { Logger } from 'pino';
import { getOptionalObservationContext } from '../context/observation-context.storage';
import { ContextLoggerPort, LoggerPort } from '../ports/logger.port';

type LogMeta = Record<string, unknown>;

@Injectable()
export class AppLoggerService implements LoggerPort, LoggerService {
  private readonly pino: Logger;

  constructor(@Inject(OBSERVABILITY_CONFIG) config: ObservabilityConfig) {
    this.pino = pino({
      level: config.logLevel,
      base: undefined, // strip pid/hostname — use OTEL resource attributes instead
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => ({ level: label }),
      },
      redact: {
        paths: ['*.password', '*.passwordHash', '*.mfaSecret', '*.token', '*.secret'],
        censor: '[REDACTED]',
      },
      ...(config.prettyPrint && {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: false, singleLine: true },
        },
      }),
      mixin(): Record<string, unknown> {
        const ctx = getOptionalObservationContext();
        if (!ctx) return {};
        return {
          correlationId: ctx.correlationId,
          ...(ctx.causationId ? { causationId: ctx.causationId } : {}),
          ...(ctx.actor?.userId ? { actorUserId: ctx.actor.userId } : {}),
          ...(ctx.actor?.storeId ? { actorStoreId: ctx.actor.storeId } : {}),
        };
      },
    });
  }

  log(message: string, meta?: LogMeta | string): void {
    this.pino.info(this.normalizeMeta(meta), message);
  }

  error(message: string, meta?: LogMeta | string): void {
    this.pino.error(this.normalizeMeta(meta), message);
  }

  warn(message: string, meta?: LogMeta | string): void {
    this.pino.warn(this.normalizeMeta(meta), message);
  }

  debug(message: string, meta?: LogMeta | string): void {
    this.pino.debug(this.normalizeMeta(meta), message);
  }

  verbose(message: string, meta?: LogMeta | string): void {
    this.pino.trace(this.normalizeMeta(meta), message);
  }

  forContext(contextName: string): ContextLoggerPort {
    const child = this.pino.child({ context: contextName });
    return new ContextLogger(child);
  }

  private normalizeMeta(meta?: LogMeta | string): LogMeta {
    if (!meta) return {};
    if (typeof meta === 'string') return { context: meta };
    return meta;
  }
}

export class ContextLogger implements ContextLoggerPort {
  constructor(private readonly pino: Logger) {}

  log(message: string, meta: Record<string, unknown> = {}): void {
    this.pino.info(meta, message);
  }
  error(message: string, meta: Record<string, unknown> = {}): void {
    this.pino.error(meta, message);
  }
  warn(message: string, meta: Record<string, unknown> = {}): void {
    this.pino.warn(meta, message);
  }
  debug(message: string, meta: Record<string, unknown> = {}): void {
    this.pino.debug(meta, message);
  }
}
