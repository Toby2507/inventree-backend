import { createOtelTestHarness, fsObservationContext, makeLoggerMock } from '@app/testing';
import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { observationStorage } from '../context/observation-context.storage';
import { SpanAttributes } from '../tracing/span-attributes';
import { ObservedRepositoryWrapper } from './observed-repository.wrapper';

interface FakeRepo {
  findById(id: string): Promise<{ id: string } | null>;
  create(data: { name: string }): Promise<void>;
}

const makeFakeRepo = (overrides: Partial<FakeRepo> = {}): FakeRepo => ({
  findById: jest.fn().mockResolvedValue({ id: 'uuid-123' }),
  create: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('ObservedRepositoryWrapper', () => {
  let repo: FakeRepo;
  let wrapper: any;
  const otel = createOtelTestHarness();
  const ctx = fsObservationContext.generate();
  const { logger, contextLogger } = makeLoggerMock();

  beforeEach(() => {
    jest.clearAllMocks();
    repo = makeFakeRepo();
    wrapper = new ObservedRepositoryWrapper(repo, 'user', logger);
  });

  it('should proxy method calls to the underlying repository', async () => {
    const result = await wrapper.findById('uuid-123');
    expect(repo.findById).toHaveBeenCalledWith('uuid-123');
    expect(result).toEqual({ id: 'uuid-123' });
  });

  it('should create a span and attach entity name and operation for every method call', async () => {
    await wrapper.findById('uuid-123');
    expect(otel.tracer.startActiveSpan).toHaveBeenCalledWith(
      expect.stringContaining('user.findById'),
      expect.objectContaining({
        kind: SpanKind.INTERNAL,
        attributes: expect.objectContaining({
          [SpanAttributes.REPOSITORY_ENTITY]: 'user',
          [SpanAttributes.REPOSITORY_OPERATION]: 'findById',
        }),
      }),
      expect.any(Function),
    );
  });

  it('should attach correlationId from ALS to span attributes when available', async () => {
    await observationStorage.run(ctx, async () => {
      await wrapper.create({ name: 'Test' });
    });
    expect(otel.tracer.startActiveSpan).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        attributes: expect.objectContaining({
          [SpanAttributes.CORRELATION_ID]: ctx.correlationId,
        }),
      }),
      expect.any(Function),
    );
  });

  it('should not attach correlationId when no context exists', async () => {
    await wrapper.findById('uuid-123');
    expect(otel.tracer.startActiveSpan).toHaveBeenCalledWith(
      expect.any(String),
      expect.not.objectContaining({
        attributes: expect.objectContaining({
          [SpanAttributes.CORRELATION_ID]: expect.anything(),
        }),
      }),
      expect.any(Function),
    );
  });

  it('should log debug on success', async () => {
    await wrapper.findById('uuid-123');
    expect(contextLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('findById ok'),
      expect.objectContaining({ durationMs: expect.any(Number) }),
    );
  });

  it('should log error and set span ERROR on repository failure', async () => {
    (repo.findById as jest.Mock).mockRejectedValue(new Error('db connection lost'));
    await expect(wrapper.findById('uuid-123')).rejects.toThrow('db connection lost');
    expect(otel.span.setStatus).toHaveBeenCalledWith(
      expect.objectContaining({ code: SpanStatusCode.ERROR }),
    );
    expect(contextLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('findById failed'),
      expect.objectContaining({ errorMessage: 'db connection lost' }),
    );
  });
});
