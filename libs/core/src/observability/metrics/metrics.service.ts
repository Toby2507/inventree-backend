import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import {
  Attributes,
  Counter,
  Histogram,
  Meter,
  metrics,
  ObservableGauge,
  ObservableResult,
  UpDownCounter,
} from '@opentelemetry/api';
import { getOptionalObservationContext } from '../context';
import { MetricName, MetricNames } from './metric-names';

type GaugeDefinition = {
  instrument?: ObservableGauge;
  callbacks: Array<{ fn: () => number; attributes: Attributes }>;
};

export const PRE_ALLOCATED_METRICS = {
  counters: [
    MetricNames.COMMAND_TOTAL,
    MetricNames.QUERY_TOTAL,
    MetricNames.HTTP_TOTAL,
    MetricNames.REPO_TOTAL,
    MetricNames.JOB_TOTAL,
  ],
  histograms: [
    MetricNames.COMMAND_DURATION,
    MetricNames.QUERY_DURATION,
    MetricNames.HTTP_DURATION,
    MetricNames.REPO_DURATION,
    MetricNames.JOB_DURATION,
  ],
  upDownCounters: [MetricNames.HTTP_ACTIVE],
};

@Injectable()
export class MetricsService implements OnApplicationBootstrap {
  private meter!: Meter;

  private readonly counters = new Map<MetricName, Counter>();
  private readonly histograms = new Map<MetricName, Histogram>();
  private readonly upDownCounters = new Map<MetricName, UpDownCounter>();
  private readonly gauges = new Map<MetricName, GaugeDefinition>();

  onApplicationBootstrap(): void {
    this.meter = metrics.getMeter('inventree', '1.0.0');
    this.preAllocateInstruments();
  }

  increment(name: MetricName, attributes: Attributes = {}, amount = 1): void {
    if (amount < 1) return;
    this.getCounter(name).add(amount, this.enrichAttributes(attributes));
  }

  record(name: MetricName, value: number, attributes: Attributes = {}): void {
    if (value < 0) return;
    this.getHistogram(name).record(value, this.enrichAttributes(attributes));
  }

  adjust(name: MetricName, delta: number, attributes: Attributes = {}): void {
    if (delta === 0) return;
    this.getUpDownCounter(name).add(delta, this.enrichAttributes(attributes));
  }

  gauge(name: MetricName, callback: () => number, attributes: Attributes = {}): void {
    const gauge = this.getGauge(name);
    gauge.callbacks.push({ fn: callback, attributes: this.enrichAttributes(attributes) });
    if (!gauge.instrument) this.initializeGauge(name);
  }

  async timeAsync<T>(
    durationMetric: MetricName,
    totalMetric: MetricName,
    attributes: Attributes,
    fn: () => Promise<T>,
  ): Promise<T> {
    const startMs = performance.now();
    try {
      const result = await fn();
      const durationMs = performance.now() - startMs;
      this.record(durationMetric, durationMs, { ...attributes, status: 'success' });
      this.increment(totalMetric, { ...attributes, status: 'success' });
      return result;
    } catch (err) {
      const durationMs = performance.now() - startMs;
      this.record(durationMetric, durationMs, { ...attributes, status: 'error' });
      this.increment(totalMetric, {
        ...attributes,
        status: 'error',
        error_type: err instanceof Error ? err.constructor.name : 'UnknownError',
      });
      throw err;
    }
  }

  private getCounter(name: MetricName): Counter {
    if (!this.counters.has(name)) this.counters.set(name, this.meter.createCounter(name));
    return this.counters.get(name)!;
  }

  private getGauge(name: MetricName): GaugeDefinition {
    if (!this.gauges.has(name)) {
      this.gauges.set(name, { callbacks: [] });
    }
    return this.gauges.get(name)!;
  }

  private getHistogram(name: MetricName): Histogram {
    if (!this.histograms.has(name)) {
      this.histograms.set(
        name,
        this.meter.createHistogram(name, {
          advice: {
            explicitBucketBoundaries: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
          },
          unit: 'ms',
        }),
      );
    }
    return this.histograms.get(name)!;
  }

  private getUpDownCounter(name: MetricName): UpDownCounter {
    if (!this.upDownCounters.has(name)) {
      this.upDownCounters.set(name, this.meter.createUpDownCounter(name));
    }
    return this.upDownCounters.get(name)!;
  }

  private initializeGauge(name: MetricName): void {
    const gauge = this.getGauge(name);
    if (!gauge || gauge.instrument) return;
    const observableGauge = this.meter.createObservableGauge(name);
    observableGauge.addCallback((result: ObservableResult) => {
      const snapshot = [...gauge.callbacks.values()];
      for (const { fn, attributes } of snapshot) {
        const value = fn();
        result.observe(value, attributes);
      }
    });
    gauge.instrument = observableGauge;
  }

  private preAllocateInstruments(): void {
    PRE_ALLOCATED_METRICS.counters.forEach((name) => this.getCounter(name));
    PRE_ALLOCATED_METRICS.histograms.forEach((name) => this.getHistogram(name));
    PRE_ALLOCATED_METRICS.upDownCounters.forEach((name) => this.getUpDownCounter(name));
    for (const name of this.gauges.keys()) this.initializeGauge(name);
  }

  private enrichAttributes(attributes: Attributes): Attributes {
    const ctx = getOptionalObservationContext();
    if (!ctx) return attributes;
    return {
      ...attributes,
      ...(ctx.actor?.role ? { actor_role: ctx.actor.role } : {}),
    };
  }
}
