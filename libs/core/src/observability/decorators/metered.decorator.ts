import { copyMethodMetadata } from '@app/common/utils';
import { MetricName, MetricNames } from '../metrics/metric-names';
import { MetricsPort } from '../ports/metrics.port';

type MeteredInstance = { metrics?: MetricsPort };
export type MeteredKind = 'command' | 'query' | 'repository' | 'job' | 'custom';

export interface MeteredOptions {
  kind?: MeteredKind;
  name?: string;
  attributes?: Record<string, string>;
}

const isDev = process.env.NODE_ENV !== 'production';
const DURATION_METRIC: Record<MeteredKind, MetricName> = {
  command: MetricNames.COMMAND_DURATION,
  query: MetricNames.QUERY_DURATION,
  repository: MetricNames.REPO_DURATION,
  job: MetricNames.JOB_DURATION,
  custom: MetricNames.CUSTOM_DURATION,
};
const TOTAL_METRIC: Record<MeteredKind, MetricName> = {
  command: MetricNames.COMMAND_TOTAL,
  query: MetricNames.QUERY_TOTAL,
  repository: MetricNames.REPO_TOTAL,
  job: MetricNames.JOB_TOTAL,
  custom: MetricNames.CUSTOM_TOTAL,
};
const LABEL_KEY: Record<MeteredKind, string> = {
  command: 'command',
  query: 'query',
  repository: 'operation',
  job: 'job',
  custom: 'operation',
};

/**
 * `@Metered()` — method decorator.
 *
 * Automatically records execution time and total count metrics for the decorated method.
 * The class must expose `this.metrics: MetricsPort` (injected via DI).
 */
export function Metered(options: MeteredOptions = {}): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<any>,
  ) {
    const original = descriptor.value as (...args: unknown[]) => Promise<unknown>;
    const className = target.constructor.name;
    const methodName = String(propertyKey);
    const kind: MeteredKind = options.kind ?? inferKind(className);
    const operationName = options.name ?? `${className}.${methodName}`;

    descriptor.value = async function (...args: unknown[]) {
      const metricsService = (this as MeteredInstance).metrics;
      if (!metricsService && isDev) {
        console.warn(
          `[Metered] metrics provider missing on ${className}, cannot record metrics for ${methodName}. Please inject Metrics and add "public metrics: MetricsPort" to the class.`,
        );
      }
      if (!metricsService) return original.apply(this, args);

      const attributes = {
        [LABEL_KEY[kind]]: operationName,
        ...options.attributes,
      };

      return metricsService.timeAsync(DURATION_METRIC[kind], TOTAL_METRIC[kind], attributes, () =>
        original.apply(this, args),
      );
    };

    copyMethodMetadata(original, descriptor.value);
    return descriptor;
  };
}

function inferKind(className: string): MeteredKind {
  if (className.endsWith('CommandHandler')) return 'command';
  if (className.endsWith('QueryHandler')) return 'query';
  if (className.endsWith('Repository')) return 'repository';
  if (className.endsWith('JobHandler') || className.endsWith('Processor')) return 'job';
  return 'custom';
}
