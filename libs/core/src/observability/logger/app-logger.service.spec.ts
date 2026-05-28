import { fsObservationContext } from '@app/testing';
import { observationStorage } from '../context';
import { AppLoggerService, ContextLogger } from './app-logger.service';

let capturedPinoConfig: Record<string, unknown> = {};
let mockIsoTime: string;
const mockPinoInstance = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
  child: jest.fn().mockReturnThis(),
};

jest.mock('pino', () => {
  const pinoFactory = jest.fn().mockImplementation((config: Record<string, unknown>) => {
    capturedPinoConfig = config;
    return mockPinoInstance;
  });
  (pinoFactory as any).stdTimeFunctions = {
    isoTime: jest.fn(() => {
      mockIsoTime = new Date().toISOString();
      return mockIsoTime;
    }),
  };
  return pinoFactory;
});

describe('AppLoggerService', () => {
  let service: AppLoggerService;
  const ctx = fsObservationContext.generate();

  const callMixin = (): Record<string, unknown> => {
    const mixin = capturedPinoConfig['mixin'] as () => Record<string, unknown>;
    if (typeof mixin !== 'function') throw new Error('mixin not found in pino config');
    return mixin();
  };

  beforeEach(() => {
    jest.clearAllMocks();
    capturedPinoConfig = {};
    service = new AppLoggerService();
  });

  describe('Pino constructor configuration', () => {
    it('should call the pino factory with a config object on construction', () => {
      expect(capturedPinoConfig).toEqual(
        expect.objectContaining({
          level: 'info',
          base: undefined,
          timestamp: expect.any(Function),
          redact: expect.objectContaining({
            censor: '[REDACTED]',
            paths: expect.arrayContaining([
              '*.password',
              '*.passwordHash',
              '*.mfaSecret',
              '*.token',
              '*.secret',
            ]),
          }),
          mixin: expect.any(Function),
        }),
      );
    });

    it('should set log level to the LOG_LEVEL env var if it is set', () => {
      const original = process.env.LOG_LEVEL;
      try {
        process.env.LOG_LEVEL = 'debug';
        new AppLoggerService();
        expect(capturedPinoConfig['level']).toBe('debug');
        delete process.env.LOG_LEVEL;
      } finally {
        process.env.LOG_LEVEL = original;
      }
    });

    it('should include a formatters.level function that returns { level: label }', () => {
      const formatters = capturedPinoConfig['formatters'] as any;
      expect(typeof formatters?.level).toBe('function');
      expect(formatters.level('warn')).toEqual({ level: 'warn' });
    });
  });

  describe('mixin()', () => {
    it('should return an empty object when no ObservationContext is set', () => {
      const result = callMixin();
      expect(result).toEqual({});
    });

    it('should inject context into mixin when available', () => {
      const result = observationStorage.run(ctx, callMixin);
      expect(result).toMatchObject({
        correlationId: ctx.correlationId,
        causationId: ctx.causationId,
        actorUserId: ctx.actor?.userId,
        actorStoreId: ctx.actor?.storeId,
      });
    });

    it('should omit optional context details from mixin when not available', () => {
      const mockCtx = fsObservationContext.generate({
        causationId: undefined,
        actor: undefined,
      });
      const result = observationStorage.run(mockCtx, callMixin);
      expect(result).not.toHaveProperty('causationId');
      expect(result).not.toHaveProperty('actorUserId');
      expect(result).not.toHaveProperty('actorStoreId');
      expect(result).toStrictEqual({ correlationId: mockCtx.correlationId });
    });

    it('should preserve context across async operations', async () => {
      await observationStorage.run(ctx, async () => {
        await Promise.resolve();
        service.log('async message');
        expect(mockPinoInstance.info).toHaveBeenCalled();
        expect(callMixin()).toMatchObject({
          correlationId: ctx.correlationId,
        });
      });
    });
  });

  describe('log method routing', () => {
    it.each([
      ['log', 'info', 'info message'],
      ['error', 'error', 'error message'],
      ['warn', 'warn', 'warn message'],
      ['debug', 'debug', 'debug message'],
      ['verbose', 'trace', 'verbose message'],
    ])('should route %s() calls to pino.%s()', (method, pinoMethod, message) => {
      (service as any)[method](message);
      expect((mockPinoInstance as any)[pinoMethod]).toHaveBeenCalledWith({}, message);
    });
  });

  describe('argument contract', () => {
    it('should pass the formatted context and message to the pino method', () => {
      service.log('my message', { userId: 'u-001', durationMs: 42 });
      expect(mockPinoInstance.info).toHaveBeenCalledWith(
        { userId: 'u-001', durationMs: 42 },
        'my message',
      );
    });

    it('should pass an empty object as the context when meta is undefined', () => {
      service.log('msg');
      expect(mockPinoInstance.info).toHaveBeenCalledWith({}, 'msg');
    });

    it('should convert a string meta into a proper context', () => {
      service.log('event', 'MyContext');
      expect(mockPinoInstance.info).toHaveBeenCalledWith({ context: 'MyContext' }, 'event');
    });
  });

  describe('forContext()', () => {
    it('should call pino.child() once with { context: contextName }', () => {
      service.forContext('RegisterUserCommandHandler');
      expect(mockPinoInstance.child).toHaveBeenCalledTimes(1);
      expect(mockPinoInstance.child).toHaveBeenCalledWith({
        context: 'RegisterUserCommandHandler',
      });
    });

    it('should return a ContextLogger instance', () => {
      const result = service.forContext('SomeHandler');
      expect(result).toBeInstanceOf(ContextLogger);
    });

    it('should return a different ContextLogger instance for each call', () => {
      const a = service.forContext('A');
      const b = service.forContext('B');
      expect(a).not.toBe(b);
    });
  });
});

describe('ContextLogger', () => {
  let contextLogger: ContextLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    contextLogger = new ContextLogger(mockPinoInstance as any);
  });

  describe('method routing', () => {
    it.each([
      ['log', 'info', 'info message'],
      ['error', 'error', 'error message'],
      ['warn', 'warn', 'warn message'],
      ['debug', 'debug', 'debug message'],
    ])('should route %s() calls to pino.%s()', (method, pinoMethod, message) => {
      (contextLogger as any)[method](message);
      expect((mockPinoInstance as any)[pinoMethod]).toHaveBeenCalledWith({}, message);
    });
  });

  describe('argument contract', () => {
    it('should pass meta as context and message to the pino method', () => {
      contextLogger.log('my message', { userId: 'u-001', durationMs: 42 });
      expect(mockPinoInstance.info).toHaveBeenCalledWith(
        { userId: 'u-001', durationMs: 42 },
        'my message',
      );
    });

    it('should pass an empty object as context when meta is not provided', () => {
      contextLogger.error('error without meta');
      expect(mockPinoInstance.error).toHaveBeenCalledWith({}, 'error without meta');
    });
  });
});
