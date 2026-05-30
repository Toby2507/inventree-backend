import { makeLoggerMock } from '@app/testing';
import { LoggerPort } from '../ports';
import { LogExecution } from './log-execution.decorator';

class SomeService {
  constructor(private readonly logger?: LoggerPort) {}

  @LogExecution()
  async doWork(): Promise<unknown> {
    return 'done';
  }

  @LogExecution('CustomContext')
  async doWorkWithCustomContext(): Promise<unknown> {
    return 'done';
  }

  @LogExecution()
  async doWorkThatFails(): Promise<never> {
    throw new Error('smtp down');
  }
}

describe('@LogExecution() decorator', () => {
  let svc: SomeService;

  const { logger, contextLogger } = makeLoggerMock();

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new SomeService(logger);
  });

  it('should log debug on successful execution with durationMs', async () => {
    await svc.doWork();
    expect(contextLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('completed'),
      expect.objectContaining({ durationMs: expect.any(Number) }),
    );
  });

  it('should log error on failed execution', async () => {
    await expect(svc.doWorkThatFails()).rejects.toThrow('smtp down');
    expect(contextLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('failed'),
      expect.objectContaining({ errorMessage: 'smtp down' }),
    );
  });

  describe('Logger forContext naming', () => {
    it('should use ClassName.methodName as default context', async () => {
      await svc.doWork();
      expect(logger.forContext).toHaveBeenCalledWith('SomeService.doWork');
    });

    it('should use custom context name when provided', async () => {
      await svc.doWorkWithCustomContext();
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
          expect.stringContaining('[LogExecution] logger missing on SomeService'),
        );
      }
    });

    it('should still execute and return original value but not log anything if logger is missing', async () => {
      const result = await svcWithoutLogger.doWork();
      expect(result).toBe('done');
      expect(contextLogger.debug).not.toHaveBeenCalled();
    });

    it('should still rethrow the original error but not log anything if logger is missing', async () => {
      await expect(svcWithoutLogger.doWorkThatFails()).rejects.toThrow('smtp down');
      expect(contextLogger.error).not.toHaveBeenCalled();
    });
  });
});
