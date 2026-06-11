import { faker } from '@app/testing';
import {
  createOtelTestHarness,
  fsSerializedBusinessContext,
  fsSerializedOutboxContext,
} from '@app/testing/core/observability';
import { ROOT_CONTEXT, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { SpanAttributes } from '../tracing/span-attributes';
import { INVENTREE_TRACER } from '../tracing/tracer.provider';
import { RestoredContextOptions, withRestoredObservationContext } from './restore-context';

const generatedUUID = faker.string.uuid();
const mockObservationRun = jest.fn((_ctx, fn) => fn());

jest.mock('uuid', () => ({
  v4: jest.fn(() => generatedUUID),
}));
jest.mock('./observation-context.storage', () => ({
  observationStorage: { run: jest.fn((_ctx, fn) => mockObservationRun(_ctx, fn)) },
}));

describe('withRestoredObservationContext()', () => {
  const otel = createOtelTestHarness();
  const defaultOptions: RestoredContextOptions = { spanName: 'test.span' };
  const serializedContext = fsSerializedOutboxContext.generate();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when no serialized context is provided', () => {
    it('should generate and propagate a fallback correlationId across tracing and observation context', async () => {
      await withRestoredObservationContext(null, defaultOptions, async () => {});
      const [, spanOpts] = otel.tracer.startActiveSpan.mock.calls[0];
      expect(spanOpts.attributes[SpanAttributes.CORRELATION_ID]).toBe(generatedUUID);
      expect(mockObservationRun).toHaveBeenCalledWith(
        expect.objectContaining({ correlationId: generatedUUID }),
        expect.any(Function),
      );
    });

    it('should not extract propagation context when serialized trace is not provided', async () => {
      await withRestoredObservationContext(null, defaultOptions, async () => {});
      expect(otel.spies.propagationExtract).not.toHaveBeenCalled();
      expect(otel.spies.contextWith).toHaveBeenCalledWith(ROOT_CONTEXT, expect.any(Function));
    });
  });

  describe('OTEL context restoration', () => {
    it('should extract and use OTEL context from serialized trace', async () => {
      await withRestoredObservationContext(serializedContext, defaultOptions, async () => {});
      expect(otel.spies.propagationExtract).toHaveBeenCalledWith(ROOT_CONTEXT, {
        traceparent: serializedContext.traceparent,
        tracestate: serializedContext.tracestate,
      });
      expect(otel.spies.contextWith).toHaveBeenCalledWith(
        expect.objectContaining({
          __extracted: true,
          traceparent: serializedContext.traceparent,
          tracestate: serializedContext.tracestate,
        }),
        expect.any(Function),
      );
    });

    it('should map actor fields correctly into observation context', async () => {
      await withRestoredObservationContext(serializedContext, defaultOptions, async () => {});
      const [obsCtx] = mockObservationRun.mock.calls[0];
      expect(obsCtx.actor).toEqual({
        userId: serializedContext.actorUserId,
        storeId: serializedContext.actorStoreId,
        role: serializedContext.actorRole,
      });
    });

    it('should not extract propagation context when trace fields are not provided', async () => {
      const contextWithoutTrace = fsSerializedBusinessContext.generate();
      await withRestoredObservationContext(contextWithoutTrace, defaultOptions, async () => {});
      expect(otel.spies.propagationExtract).not.toHaveBeenCalled();
      expect(otel.spies.contextWith).toHaveBeenCalledWith(ROOT_CONTEXT, expect.any(Function));
    });
  });

  describe('Span creation', () => {
    it('should create a span with correct name, kind, and attributes', async () => {
      const customAttributes = { 'custom.attr': 'value' };
      await withRestoredObservationContext(
        serializedContext,
        { ...defaultOptions, spanKind: 2, spanAttributes: customAttributes },
        async () => {},
      );
      expect(otel.tracer.startActiveSpan).toHaveBeenCalledTimes(1);
      expect(otel.tracer.startActiveSpan).toHaveBeenCalledWith(
        defaultOptions.spanName,
        expect.objectContaining({
          kind: 2,
          attributes: expect.objectContaining({
            ...customAttributes,
          }),
        }),
        expect.any(Function),
      );
    });

    it('should allow custom span attributes to override default ones', async () => {
      const customCorrelationId = faker.string.uuid();
      await withRestoredObservationContext(
        serializedContext,
        {
          ...defaultOptions,
          spanAttributes: { [SpanAttributes.CORRELATION_ID]: customCorrelationId },
        },
        async () => {},
      );
      const [, spanOpts] = otel.tracer.startActiveSpan.mock.calls[0];
      expect(spanOpts.attributes[SpanAttributes.CORRELATION_ID]).toBe(customCorrelationId);
    });

    it('should create a tracer using the INVENTREE_TRACER name', async () => {
      await withRestoredObservationContext(serializedContext, defaultOptions, async () => {});
      expect(otel.spies.getTracer).toHaveBeenCalledWith(INVENTREE_TRACER);
    });
  });

  describe('fn() invocation', () => {
    it('should execute fn exactly once and return its result', async () => {
      const fn = jest.fn().mockResolvedValue('result');
      const result = await withRestoredObservationContext(serializedContext, defaultOptions, fn);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith(/* nothing */);
      expect(result).toBe('result');
    });

    // Regression test to ensure span status is not set before fn() completes, which would cause premature context teardown and loss of error information if fn() throws
    it('should await fn() before setting span status', async () => {
      const events: string[] = [];
      const fn = async () => {
        await Promise.resolve();
        events.push('fn');
      };
      otel.span.setStatus.mockImplementation(() => {
        events.push('setStatus');
      });
      await withRestoredObservationContext(serializedContext, defaultOptions, fn);
      expect(events).toEqual(['fn', 'setStatus']);
    });
  });

  describe('Span lifecycle', () => {
    it('should set span status to OK and end it on successful completion', async () => {
      await withRestoredObservationContext(serializedContext, defaultOptions, async () => 'ok');
      expect(otel.span.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
      expect(otel.span.end).toHaveBeenCalled();
      expect(otel.span.recordException).not.toHaveBeenCalled();
    });

    it('should record exception, set span status to ERROR, and end it when fn() throws', async () => {
      const error = new Error('test error');
      const fn = jest.fn().mockRejectedValue(error);
      await expect(
        withRestoredObservationContext(serializedContext, defaultOptions, fn),
      ).rejects.toThrow('test error');
      expect(otel.span.recordException).toHaveBeenCalledWith(error);
      expect(otel.span.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      expect(otel.span.end).toHaveBeenCalled();
    });
  });

  describe('ObservationContext full round-trip restoration', () => {
    it('should correctly propagate every field end-to-end', async () => {
      const fn = jest.fn().mockResolvedValue('full-result');
      const result = await withRestoredObservationContext(
        serializedContext,
        {
          spanName: 'outbox.process.full.roundtrip',
          spanKind: SpanKind.CONSUMER,
          spanAttributes: { 'test.extra.attributes': 'static-value' },
        },
        fn,
      );
      expect(result).toBe('full-result');
      expect(otel.spies.propagationExtract).toHaveBeenCalledWith(ROOT_CONTEXT, {
        traceparent: serializedContext.traceparent,
        tracestate: serializedContext.tracestate,
      });
      expect(otel.tracer.startActiveSpan).toHaveBeenCalledWith(
        'outbox.process.full.roundtrip',
        expect.objectContaining({
          kind: SpanKind.CONSUMER,
          attributes: expect.objectContaining({
            [SpanAttributes.CORRELATION_ID]: serializedContext.correlationId,
            [SpanAttributes.CAUSATION_ID]: serializedContext.causationId,
            [SpanAttributes.ACTOR_USER_ID]: serializedContext.actorUserId,
            [SpanAttributes.ACTOR_STORE_ID]: serializedContext.actorStoreId,
            'test.extra.attributes': 'static-value',
          }),
        }),
        expect.any(Function),
      );
      expect(mockObservationRun).toHaveBeenCalledWith(
        {
          correlationId: serializedContext.correlationId,
          causationId: serializedContext.causationId,
          idempotencyKey: serializedContext.idempotencyKey,
          actor: {
            userId: serializedContext.actorUserId,
            storeId: serializedContext.actorStoreId,
            role: serializedContext.actorRole,
          },
        },
        expect.any(Function),
      );
      expect(fn).toHaveBeenCalledTimes(1);
      expect(otel.span.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
      expect(otel.span.recordException).not.toHaveBeenCalled();
      expect(otel.span.end).toHaveBeenCalledTimes(1);
    });
  });
});
