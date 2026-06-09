import { CAUSATION_HEADER, CORRELATION_HEADER, IDEMPOTENCY_HEADER } from '@app/common/constants';
import { Fn } from '@app/common/types';
import { faker } from '@app/testing';
import { createOtelTestHarness } from '@app/testing/core/observability';
import { makeRequestMock, makeResponseMock } from '@app/testing/system';
import { getOptionalObservationContext } from '../context/observation-context.storage';
import { SpanAttributes } from '../tracing/span-attributes';
import { ObservationContextMiddleware } from './observation-context.middleware';

const generatedUUID = faker.string.uuid();
jest.mock('uuid', () => ({
  v4: jest.fn(() => generatedUUID),
}));

describe('ObservationContextMiddleware', () => {
  let middleware: ObservationContextMiddleware;
  const otel = createOtelTestHarness();

  const runInMiddleware = (req: any, res: any, fn?: Fn) => {
    return new Promise<void>((resolve) => {
      const next = async () => {
        if (!!fn) await fn();
        resolve();
      };
      middleware.use(req, res, next);
    });
  };

  beforeEach(() => {
    middleware = new ObservationContextMiddleware();
    jest.clearAllMocks();
  });

  describe('Header extraction', () => {
    it('should extract correlationId, causationId, and idempotencyKey from headers', async () => {
      const req = makeRequestMock({
        headers: {
          [CORRELATION_HEADER]: 'corr-123',
          [CAUSATION_HEADER]: 'cause-456',
          [IDEMPOTENCY_HEADER]: 'idem-789',
        },
      });
      const res = makeResponseMock();
      const next = () => {
        const ctx = getOptionalObservationContext();
        expect(ctx?.correlationId).toBe('corr-123');
        expect(ctx?.causationId).toBe('cause-456');
        expect(ctx?.idempotencyKey).toBe('idem-789');
      };
      await runInMiddleware(req, res, next);
    });

    it('should handle missing headers gracefully', async () => {
      const req = makeRequestMock();
      const res = makeResponseMock();
      const next = () => {
        const ctx = getOptionalObservationContext();
        expect(ctx?.correlationId).toBe(generatedUUID);
        expect(ctx?.causationId).toBeUndefined();
        expect(ctx?.idempotencyKey).toBeUndefined();
      };
      await runInMiddleware(req, res, next);
    });

    it('should echo the correlation ID back in the response header', async () => {
      const req = makeRequestMock({ headers: { [CORRELATION_HEADER]: 'echo-me' } });
      const res = makeResponseMock();
      await runInMiddleware(req, res);
      expect(res.setHeader).toHaveBeenCalledWith(CORRELATION_HEADER, 'echo-me');
    });
  });

  describe('Span lifecycle', () => {
    it('should fetch the active span and set business attributes', async () => {
      const req = makeRequestMock({
        headers: { [CORRELATION_HEADER]: 'corr-001', [CAUSATION_HEADER]: 'cause-001' },
      });
      const res = makeResponseMock();
      const next = () => {
        expect(otel.span.setAttributes).toHaveBeenCalledWith({
          [SpanAttributes.CORRELATION_ID]: 'corr-001',
          [SpanAttributes.CAUSATION_ID]: 'cause-001',
        });
      };
      await runInMiddleware(req, res, next);
    });
  });

  describe('context isolation', () => {
    it('should not make context accessible outside next()', async () => {
      const req = makeRequestMock();
      const res = makeResponseMock();
      await runInMiddleware(req, res);
      expect(getOptionalObservationContext()).toBeUndefined();
    });

    it('should have independent contexts for two concurrent requests', async () => {
      const capturedIds: string[] = [];
      const runRequest = async (corrId: string) => {
        const req = makeRequestMock({ headers: { [CORRELATION_HEADER]: corrId } });
        const res = makeResponseMock();
        const next = () => {
          capturedIds.push(getOptionalObservationContext()?.correlationId ?? 'none');
        };
        await runInMiddleware(req, res, next);
      };
      await Promise.all([runRequest('req-A'), runRequest('req-B')]);
      expect(capturedIds).toContain('req-A');
      expect(capturedIds).toContain('req-B');
    });
  });
});
