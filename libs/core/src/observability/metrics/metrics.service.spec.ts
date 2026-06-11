import { createOtelTestHarness, fsObservationContext } from '@app/testing/core/observability';
import { observationStorage } from '../context/observation-context.storage';
import { MetricNames } from './metric-names';
import { MetricsService, PRE_ALLOCATED_METRICS } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;
  const otel = createOtelTestHarness();
  const ctx = fsObservationContext.generate();

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MetricsService();
    service.onApplicationBootstrap();
  });

  describe('On Application Bootstrap', () => {
    it('should get meter for metrics', () => {
      expect(otel.spies.getMeter).toHaveBeenCalledWith('inventree', expect.any(String));
    });

    it.each([
      ['counter', otel.meter.createCounter, PRE_ALLOCATED_METRICS.counters],
      ['histogram', otel.meter.createHistogram, PRE_ALLOCATED_METRICS.histograms],
      ['up down counter', otel.meter.createUpDownCounter, PRE_ALLOCATED_METRICS.upDownCounters],
    ])('should pre-allocate %s instruments', (_desc, createFn, expectedMetrics) => {
      expect(createFn).toHaveBeenCalledTimes(expectedMetrics.length);
      expect(createFn.mock.calls.map(([name]) => name)).toEqual(expectedMetrics);
    });

    it('should not re-initialize gauges already initialized via .gauge()', () => {
      service.gauge(MetricNames.JOB_TOTAL, () => 1);
      jest.clearAllMocks();
      service.onApplicationBootstrap();
      expect(otel.meter.createObservableGauge).toHaveBeenCalledTimes(0);
    });
  });

  describe('MetricsService.increment()', () => {
    it('should increment counter by provided amount and attach attributes', () => {
      service.increment(MetricNames.COMMAND_TOTAL, { command: 'RegisterUser' }, 5);
      expect(otel.instruments.counter.add).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ command: 'RegisterUser' }),
      );
    });

    it('should increment counter by 1 and attach an empty object when no amount and attributes are provided', () => {
      service.increment(MetricNames.COMMAND_TOTAL);
      expect(otel.instruments.counter.add).toHaveBeenCalledWith(1, expect.any(Object));
    });

    it('should not increment counter if amount is less than 1', () => {
      service.increment(MetricNames.COMMAND_TOTAL, {}, 0);
      service.increment(MetricNames.COMMAND_TOTAL, {}, -5);
      expect(otel.instruments.counter.add).not.toHaveBeenCalled();
    });

    it('enriches attributes with actor.role from ALS', async () => {
      await observationStorage.run(ctx, async () => {
        service.increment(MetricNames.COMMAND_TOTAL, { context: 'MyContext' });
      });
      expect(otel.instruments.counter.add).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ actor_role: ctx.actor?.role, context: 'MyContext' }),
      );
    });
  });

  describe('MetricsService.record()', () => {
    it('should record the correct histogram value', () => {
      service.record(MetricNames.COMMAND_DURATION, 123, { command: 'Foo' });
      expect(otel.instruments.histogram.record).toHaveBeenCalledWith(
        123,
        expect.objectContaining({ command: 'Foo' }),
      );
    });

    it('should record with empty attributes when none are provided', () => {
      service.record(MetricNames.COMMAND_DURATION, 123);
      expect(otel.instruments.histogram.record).toHaveBeenCalledWith(123, expect.any(Object));
    });

    it("should not record histogram value if it's negative", () => {
      service.record(MetricNames.COMMAND_DURATION, -1);
      expect(otel.instruments.histogram.record).not.toHaveBeenCalled();
    });

    it('should enrich attributes with actor.role from ALS', async () => {
      await observationStorage.run(ctx, async () => {
        service.record(MetricNames.COMMAND_DURATION, 123, { context: 'MyContext' });
      });
      expect(otel.instruments.histogram.record).toHaveBeenCalledWith(
        123,
        expect.objectContaining({ actor_role: ctx.actor?.role, context: 'MyContext' }),
      );
    });
  });

  describe('MetricsService.adjust()', () => {
    it('should update the upDownCounter with the correct value', () => {
      service.adjust(MetricNames.HTTP_ACTIVE, 1, { route: '/api/v1/auth' });
      expect(otel.instruments.upDown.add).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ route: '/api/v1/auth' }),
      );
    });

    it('should update the upDownCounter with empty attributes when none are provided', () => {
      service.adjust(MetricNames.HTTP_ACTIVE, -1);
      expect(otel.instruments.upDown.add).toHaveBeenCalledWith(-1, expect.any(Object));
    });

    it('should not update upDownCounter if delta is zero', () => {
      service.adjust(MetricNames.HTTP_ACTIVE, 0);
      expect(otel.instruments.upDown.add).not.toHaveBeenCalled();
    });

    it('should enrich attributes with actor.role from ALS', async () => {
      await observationStorage.run(ctx, async () => {
        service.adjust(MetricNames.HTTP_ACTIVE, 1, { route: '/api/v1/auth' });
      });
      expect(otel.instruments.upDown.add).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ actor_role: ctx.actor?.role, route: '/api/v1/auth' }),
      );
    });
  });

  describe('MetricsService.timeAsync()', () => {
    it('should return callback result and record duration and increment total on success', async () => {
      const result = await service.timeAsync(
        MetricNames.COMMAND_DURATION,
        MetricNames.COMMAND_TOTAL,
        { command: 'RegisterUser' },
        async () => 'result',
      );
      expect(result).toBe('result');
      expect(otel.instruments.counter.add).toHaveBeenCalledTimes(1);
      expect(otel.instruments.counter.add).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ status: 'success', command: 'RegisterUser' }),
      );
      expect(otel.instruments.histogram.record).toHaveBeenCalledTimes(1);
      expect(otel.instruments.histogram.record).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({ status: 'success', command: 'RegisterUser' }),
      );
    });

    it('should re throw original error and record duration and increment total with status=error on error', async () => {
      const error = new Error('UserEmailAlreadyExistsException');
      await expect(
        service.timeAsync(
          MetricNames.COMMAND_DURATION,
          MetricNames.COMMAND_TOTAL,
          { command: 'RegisterUser' },
          async () => {
            throw error;
          },
        ),
      ).rejects.toThrow(error);
      expect(otel.instruments.counter.add).toHaveBeenCalledTimes(1);
      expect(otel.instruments.counter.add).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ status: 'error', error_type: 'Error', command: 'RegisterUser' }),
      );
      expect(otel.instruments.histogram.record).toHaveBeenCalledTimes(1);
      expect(otel.instruments.histogram.record).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({ status: 'error', command: 'RegisterUser' }),
      );
    });
  });
});
