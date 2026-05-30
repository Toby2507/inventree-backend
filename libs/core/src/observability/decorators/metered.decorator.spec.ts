import { makeMetricsMock } from '@app/testing';
import { MetricNames } from '../metrics';
import { MetricsPort } from '../ports';
import { Metered } from './metered.decorator';

class SomeService {
  constructor(private readonly metrics?: MetricsPort) {}

  @Metered()
  async doWork(): Promise<string> {
    return 'done';
  }

  @Metered({ kind: 'query' })
  async doWorkWithCustomKind(): Promise<unknown> {
    return { kind: 'query' };
  }

  @Metered({ name: 'custom.operation.name' })
  async doWorkWithCustomName(): Promise<unknown> {
    return { name: 'custom' };
  }

  @Metered({ attributes: { bounded_context: 'identity' } })
  async doWorkWithAttributes(): Promise<unknown> {
    return { context: 'identity' };
  }

  @Metered()
  async doWorkThatFails(): Promise<never> {
    throw new Error('metered error');
  }
}
class RegisterUserCommandHandler {
  constructor(public readonly metrics: MetricsPort) {}
  @Metered()
  async execute(): Promise<void> {}
}
class GetTransactionQueryHandler {
  constructor(public readonly metrics: MetricsPort) {}
  @Metered()
  async execute(): Promise<void> {}
}
class UserKyselyRepository {
  constructor(public readonly metrics: MetricsPort) {}
  @Metered()
  async create(): Promise<void> {}
}
class EmailJobHandler {
  constructor(public readonly metrics: MetricsPort) {}
  @Metered()
  async handle(): Promise<void> {}
}
class QueueProcessor {
  constructor(public readonly metrics: MetricsPort) {}
  @Metered()
  async process(): Promise<void> {}
}

describe('@Metered() decorator', () => {
  const metrics = makeMetricsMock();

  beforeEach(() => jest.clearAllMocks());

  it('should execute wrapped function and return result', async () => {
    const svc = new SomeService(metrics);
    const result = await svc.doWork();
    expect(result).toBe('done');
  });

  describe('kind inference from class name', () => {
    it('should infer command kind for CommandHandler classes', async () => {
      const svc = new RegisterUserCommandHandler(metrics);
      await svc.execute();
      expect(metrics.timeAsync).toHaveBeenCalledWith(
        MetricNames.COMMAND_DURATION,
        MetricNames.COMMAND_TOTAL,
        expect.objectContaining({ command: 'RegisterUserCommandHandler.execute' }),
        expect.any(Function),
      );
    });

    it('should infer query kind for QueryHandler classes', async () => {
      const svc = new GetTransactionQueryHandler(metrics);
      await svc.execute();
      expect(metrics.timeAsync).toHaveBeenCalledWith(
        MetricNames.QUERY_DURATION,
        MetricNames.QUERY_TOTAL,
        expect.objectContaining({ query: 'GetTransactionQueryHandler.execute' }),
        expect.any(Function),
      );
    });

    it('should infer repository kind for Repository classes', async () => {
      const svc = new UserKyselyRepository(metrics);
      await svc.create();
      expect(metrics.timeAsync).toHaveBeenCalledWith(
        MetricNames.REPO_DURATION,
        MetricNames.REPO_TOTAL,
        expect.objectContaining({ operation: 'UserKyselyRepository.create' }),
        expect.any(Function),
      );
    });

    it('should infer job kind for JobHandler classes', async () => {
      const svc = new EmailJobHandler(metrics);
      await svc.handle();
      expect(metrics.timeAsync).toHaveBeenCalledWith(
        MetricNames.JOB_DURATION,
        MetricNames.JOB_TOTAL,
        expect.objectContaining({ job: 'EmailJobHandler.handle' }),
        expect.any(Function),
      );
    });

    it('should infer job kind for Processor classes', async () => {
      const svc = new QueueProcessor(metrics);
      await svc.process();
      expect(metrics.timeAsync).toHaveBeenCalledWith(
        MetricNames.JOB_DURATION,
        MetricNames.JOB_TOTAL,
        expect.objectContaining({ job: 'QueueProcessor.process' }),
        expect.any(Function),
      );
    });

    it('should fall back to custom for unrecognised class names', async () => {
      const svc = new SomeService(metrics);
      await svc.doWork();
      expect(metrics.timeAsync).toHaveBeenCalledWith(
        MetricNames.CUSTOM_DURATION,
        MetricNames.CUSTOM_TOTAL,
        expect.objectContaining({ operation: 'SomeService.doWork' }),
        expect.any(Function),
      );
    });
  });

  describe('explicit options', () => {
    let svc: SomeService;

    beforeEach(() => {
      svc = new SomeService(metrics);
    });

    it('should use the provided kind even for a non-QueryHandler class', async () => {
      await svc.doWorkWithCustomKind();
      expect(metrics.timeAsync).toHaveBeenCalledWith(
        MetricNames.QUERY_DURATION,
        MetricNames.QUERY_TOTAL,
        expect.anything(),
        expect.any(Function),
      );
    });

    it('should use the provided name as the operation label', async () => {
      await svc.doWorkWithCustomName();
      const call = metrics.timeAsync.mock.calls[0];
      const attrs = call[2];
      expect(Object.values(attrs)).toContain('custom.operation.name');
    });

    it('should merge static attributes into every data point', async () => {
      await svc.doWorkWithAttributes();
      const call = metrics.timeAsync.mock.calls[0];
      const attrs = call[2];
      expect(attrs.bounded_context).toBe('identity');
    });
  });

  describe('Class without metrics', () => {
    let warnSpy: jest.SpyInstance;
    let svc: SomeService;

    beforeEach(() => {
      svc = new SomeService(); // No metrics injected
      warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('should warn about missing metrics service in development', async () => {
      await svc.doWork();
      if (process.env.NODE_ENV === 'production') expect(warnSpy).not.toHaveBeenCalled();
      else {
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('[Metered] metrics provider missing on SomeService'),
        );
      }
    });

    it('should propagate original return value but not record any metrics if metrics service is missing', async () => {
      const result = await svc.doWork();
      expect(result).toBe('done');
      expect(metrics.timeAsync).not.toHaveBeenCalled();
    });

    it('should propagate original error but not record any metrics if metrics service is missing', async () => {
      await expect(svc.doWorkThatFails()).rejects.toThrow('metered error');
      expect(metrics.timeAsync).not.toHaveBeenCalled();
    });
  });
});
