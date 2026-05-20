import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import {
  CompositePropagator,
  W3CBaggagePropagator,
  W3CTraceContextPropagator,
} from '@opentelemetry/core';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { Resource, resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK, NodeSDKConfiguration } from '@opentelemetry/sdk-node';
import {
  BatchSpanProcessor,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

interface ObservabilityConfig {
  serviceName: string;
  serviceVersion?: string;
  otlpEndpoint?: string; // grpc endpoint e.g. http://otel-collector:4317
}

export function bootstrapTelemetry(props: ObservabilityConfig): void {
  const url = props.otlpEndpoint || process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);

  const resource: Resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: props.serviceName,
    [ATTR_SERVICE_VERSION]: props.serviceVersion ?? '0.0.0',
    'deployment.environment': process.env.NODE_ENV ?? 'development',
  });
  const traceExporter = new OTLPTraceExporter({ url });
  const metricExporter = new OTLPMetricExporter({ url });
  const logExporter = new OTLPLogExporter({ url });

  const config: Partial<NodeSDKConfiguration> = {
    resource,
    sampler: new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(isDev ? 1.0 : 0.1), // sample all in dev, 10% in prod
    }),
    spanProcessors: [new BatchSpanProcessor(traceExporter)],
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: 30_000,
      }),
    ],
    logRecordProcessors: [new BatchLogRecordProcessor(logExporter)],
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-pg': { enhancedDatabaseReporting: false },
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-pino': { enabled: true },
      }),
    ],
    textMapPropagator: new CompositePropagator({
      propagators: [new W3CTraceContextPropagator(), new W3CBaggagePropagator()],
    }),
  };

  const sdk = new NodeSDK(config);
  sdk.start();

  let isShuttingDown = false;
  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    await sdk.shutdown();
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  process.on('beforeExit', shutdown);
}
