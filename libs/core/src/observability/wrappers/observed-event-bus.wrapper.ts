import { EventBus, IEvent } from '@nestjs/cqrs';
import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { getOptionalObservationContext } from '../context';
import { AppLoggerService } from '../logger';
import { INVENTREE_TRACER, SpanAttributes } from '../tracing';

export class ObservedEventBusWrapper {
  private readonly logger;

  constructor(
    private readonly eventBus: EventBus,
    logger: AppLoggerService,
  ) {
    this.logger = logger.forContext('EventBus');
  }

  async publishAll(events: IEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  async publish(event: IEvent): Promise<void> {
    const eventType = event.constructor.name;
    const ctx = getOptionalObservationContext();
    const tracer = trace.getTracer(INVENTREE_TRACER);

    return tracer.startActiveSpan(
      `event.publish.${eventType}`,
      {
        kind: SpanKind.PRODUCER,
        attributes: {
          [SpanAttributes.EVENT_TYPE]: eventType,
          ...(ctx ? { [SpanAttributes.CORRELATION_ID]: ctx.correlationId } : {}),
        },
      },
      async (span) => {
        try {
          await this.eventBus.publish(event);
          span.setStatus({ code: SpanStatusCode.OK });
          this.logger.debug('Event published', { eventType });
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          span.recordException(error);
          span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
          this.logger.error('Event publish failed', { eventType, errorMessage: error.message });
          throw err;
        } finally {
          span.end();
        }
      },
    );
  }
}
