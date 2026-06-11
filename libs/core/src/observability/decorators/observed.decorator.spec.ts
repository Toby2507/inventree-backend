import { Fn } from '@app/common/types';
import {
  createOtelTestHarness,
  fsObservationContext,
  makeLoggerMock,
} from '@app/testing/core/observability';
import { observationStorage } from '../context/observation-context.storage';
import { LoggerPort } from '../ports/logger.port';
import { Observed } from './observed.decorator';

class SomeService {
  constructor(private readonly logger?: LoggerPort) {}

  @Observed()
  async doWork(fn?: Fn): Promise<string> {
    if (fn) await fn();
    return 'done';
  }

  @Observed({ logArgs: true, redactArgKeys: ['account', 'password'] })
  async doWorkAndLogArgs(args: {
    email: string;
    password: string;
    account: string;
  }): Promise<string> {
    return `Email: ${args.email}; Password: ${args.password}; Account: ${args.account}`;
  }

  @Observed({ logResult: true, redactResultKeys: ['pii'] })
  async doWorkAndLogResult(): Promise<{ success: boolean; data: string; pii: string }> {
    return { success: true, data: 'result data', pii: 'sensitive information' };
  }

  @Observed({ logContext: 'CustomContext' })
  async doWorkWithCustomLogContext(): Promise<string> {
    return 'custom context';
  }

  @Observed()
  async doWorkThatFails(): Promise<never> {
    throw new Error('business rule failed');
  }
}

describe('@Observed() decorator', () => {
  let svc: SomeService;

  const otel = createOtelTestHarness();
  const ctx = fsObservationContext.generate();
  const { logger, contextLogger } = makeLoggerMock();

  const findLogMeta = (msg: string) =>
    contextLogger.log.mock.calls.find(([m]) => m.includes(msg))?.[1] as any;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new SomeService(logger);
  });

  it('should log started and completed messages on success', async () => {
    await observationStorage.run(ctx, async () => {
      await svc.doWork();
    });
    expect(contextLogger.log).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('started'),
      expect.anything(),
    );
    expect(contextLogger.log).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('completed'),
      expect.objectContaining({ durationMs: expect.any(Number) }),
    );
  });

  it('should log failed message with errorMessage on throw', async () => {
    await expect(observationStorage.run(ctx, () => svc.doWorkThatFails())).rejects.toThrow();
    expect(contextLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('failed'),
      expect.objectContaining({ errorMessage: 'business rule failed' }),
    );
  });

  it('should redact default and custom keys in args when logArgs is true', async () => {
    await observationStorage.run(ctx, async () => {
      await svc.doWorkAndLogArgs({
        email: 'a@b.com',
        password: 'SuperSecret123!',
        account: '12345',
      });
    });
    const meta = findLogMeta('started');
    const args = meta?.args?.[0];
    expect(args?.password).toBe('[REDACTED]');
    expect(args?.account).toBe('[REDACTED]');
    expect(args?.email).toBe('a@b.com');
  });

  it('should redact default and custom keys in result when logResult is true', async () => {
    await observationStorage.run(ctx, async () => {
      await svc.doWorkAndLogResult();
    });
    const meta = findLogMeta('completed');
    const result = meta?.result;
    expect(result?.pii).toBe('[REDACTED]');
    expect(result?.success).toBe(true);
    expect(result?.data).toBe('result data');
  });

  it('should log completion after the method resolves', async () => {
    const events: string[] = [];
    contextLogger.log.mockImplementation((msg: string) => {
      events.push(msg);
    });
    await observationStorage.run(ctx, async () => {
      await svc.doWork(() => events.push('method-resolved'));
    });
    expect(events).toEqual([
      expect.stringContaining('started'),
      'method-resolved',
      expect.stringContaining('completed'),
    ]);
  });

  describe('Logger forContext naming', () => {
    it('should default log context to ClassName.methodName', async () => {
      await observationStorage.run(ctx, async () => {
        await svc.doWork();
      });
      expect(logger.forContext).toHaveBeenCalledWith('SomeService.doWork');
    });

    it('should use logContext option as the context name', async () => {
      await observationStorage.run(ctx, async () => {
        await svc.doWorkWithCustomLogContext();
      });
      expect(logger.forContext).toHaveBeenCalledWith('CustomContext');
    });
  });

  describe('Class without logger', () => {
    let warnSpy: jest.SpyInstance;
    let svcWithoutLogger: SomeService;

    beforeEach(() => {
      svcWithoutLogger = new SomeService();
      warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('should warn about missing logger in development', async () => {
      await svcWithoutLogger.doWork();
      if (process.env.NODE_ENV === 'production') expect(warnSpy).not.toHaveBeenCalled();
      else {
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('[Observed] logger missing on SomeService'),
        );
      }
    });

    it('should work but not log anything if logger is missing', async () => {
      const result = await svcWithoutLogger.doWork();
      expect(result).toBe('done');
      expect(contextLogger.log).not.toHaveBeenCalled();
      expect(contextLogger.error).not.toHaveBeenCalled();
    });

    it('should still create spans via Trace even without a logger', async () => {
      await observationStorage.run(ctx, async () => {
        await svcWithoutLogger.doWork();
      });
      expect(otel.tracer.startActiveSpan).toHaveBeenCalled();
    });
  });
});
