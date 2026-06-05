import { createOtelTestHarness, fsObservationContext } from '@app/testing/core/observability';
import { faker } from '@app/testing/utils';
import { SpanStatusCode } from '@opentelemetry/api';
import { observationStorage } from '../context/observation-context.storage';
import { SpanAttributes } from '../tracing/span-attributes';
import { Trace } from './trace.decorator';

class SomeService {
  @Trace()
  async doWork(): Promise<string> {
    return 'done';
  }

  @Trace({ name: 'custom.span.name' })
  async doWorkWithCustomSpanName(): Promise<string> {
    return 'named';
  }

  @Trace({ attributes: { layer: 'domain' } })
  async doWorkWithAttributes(): Promise<string> {
    return 'attributed';
  }

  @Trace()
  async doWorkThatThrows(): Promise<never> {
    throw new Error('domain rule violated');
  }
}

describe('@Trace() decorator', () => {
  let svc: SomeService;

  const otel = createOtelTestHarness();
  const ctx = fsObservationContext.generate();

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new SomeService();
  });

  it('should return the original method result', async () => {
    await observationStorage.run(ctx, async () => {
      expect(await svc.doWork()).toBe('done');
    });
  });

  it('should use ClassName.methodName as the default span name', async () => {
    await observationStorage.run(ctx, async () => {
      await svc.doWork();
    });
    expect(otel.tracer.startActiveSpan).toHaveBeenCalledWith(
      'SomeService.doWork',
      expect.anything(),
      expect.any(Function),
    );
  });

  it('should use the provided name option when specified', async () => {
    await observationStorage.run(ctx, async () => {
      await svc.doWorkWithCustomSpanName();
    });
    expect(otel.tracer.startActiveSpan).toHaveBeenCalledWith(
      'custom.span.name',
      expect.anything(),
      expect.any(Function),
    );
  });

  it('should attach static attributes to the span', async () => {
    await observationStorage.run(ctx, async () => {
      await svc.doWorkWithAttributes();
    });
    expect(otel.tracer.startActiveSpan).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        attributes: expect.objectContaining({ layer: 'domain' }),
      }),
      expect.any(Function),
    );
  });

  it('should attach correlationId from ALS automatically', async () => {
    await observationStorage.run(ctx, async () => {
      await svc.doWork();
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

  it('should attach causationId and actor info from ALS automatically if available', async () => {
    const ctxWithOptions = fsObservationContext.generate({
      causationId: faker.string.uuid(),
      actor: {
        userId: faker.string.uuid(),
        storeId: faker.string.uuid(),
        role: 'admin',
      },
    });
    await observationStorage.run(ctxWithOptions, async () => {
      await svc.doWork();
    });
    expect(otel.tracer.startActiveSpan).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        attributes: expect.objectContaining({
          [SpanAttributes.CAUSATION_ID]: ctxWithOptions.causationId,
          [SpanAttributes.ACTOR_USER_ID]: ctxWithOptions.actor?.userId,
          [SpanAttributes.ACTOR_STORE_ID]: ctxWithOptions.actor?.storeId,
        }),
      }),
      expect.any(Function),
    );
  });

  it('should mark span OK on success', async () => {
    await observationStorage.run(ctx, async () => {
      await svc.doWork();
    });
    expect(otel.span.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
    expect(otel.span.end).toHaveBeenCalled();
  });

  it('should record exception and mark span ERROR on throw', async () => {
    await expect(observationStorage.run(ctx, () => svc.doWorkThatThrows())).rejects.toThrow(
      'domain rule violated',
    );
    expect(otel.span.recordException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'domain rule violated' }),
    );
    expect(otel.span.setStatus).toHaveBeenCalledWith(
      expect.objectContaining({ code: SpanStatusCode.ERROR }),
    );
  });

  it('should always end the span even when the method throws', async () => {
    await expect(observationStorage.run(ctx, () => svc.doWorkThatThrows())).rejects.toThrow();
    expect(otel.span.end).toHaveBeenCalled();
  });

  it('should set ERROR status before ending the span', async () => {
    const events: string[] = [];
    otel.span.setStatus.mockImplementation(() => {
      events.push('setStatus');
    });
    otel.span.end.mockImplementation(() => {
      events.push('end');
    });
    await expect(observationStorage.run(ctx, () => svc.doWorkThatThrows())).rejects.toThrow();
    expect(events).toEqual(['setStatus', 'end']);
  });

  it('should create spans even without an ObservationContext', async () => {
    const result = await svc.doWork();
    const [, options] = otel.tracer.startActiveSpan.mock.calls[0];
    expect(result).toBe('done');
    expect(otel.tracer.startActiveSpan).toHaveBeenCalled();
    expect(options.attributes).not.toHaveProperty(SpanAttributes.CORRELATION_ID);
  });
});
