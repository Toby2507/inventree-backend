import { Attributes } from '@opentelemetry/api';
import { MetricName } from '../metrics';

export interface MetricsPort {
  increment(name: MetricName, attributes?: Attributes, amount?: number): void;
  record(name: MetricName, value: number, attributes?: Attributes): void;
  adjust(name: MetricName, delta: number, attributes?: Attributes): void;
  gauge(name: MetricName, callback: () => number, attributes?: Attributes): void;
  timeAsync<T>(
    durationMetric: MetricName,
    totalMetric: MetricName,
    attributes: Attributes,
    fn: () => Promise<T>,
  ): Promise<T>;
}

export const METRICS = Symbol('METRICS');
