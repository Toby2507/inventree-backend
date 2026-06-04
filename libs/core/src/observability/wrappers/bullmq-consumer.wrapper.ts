import { context as otelCtx, trace } from '@opentelemetry/api';
import { Job } from 'bullmq';
import { v4 as uuidV4 } from 'uuid';
import { ObservationContext, SerializedBusinessContext } from '../context/observation-context';
import { observationStorage } from '../context/observation-context.storage';
import { LoggerPort } from '../ports/logger.port';
import { SpanAttributes } from '../tracing/span-attributes';
import { JobPayload } from './bullmq-producer.wrapper';

type JobProcessor<T> = (job: Job<JobPayload<T>>, data: T) => Promise<void>;

export function createObservedProcessor<T>(
  queueName: string,
  logger: LoggerPort,
  processor: JobProcessor<T>,
): (job: Job<JobPayload<T>>) => Promise<void> {
  const log = logger.forContext(`Worker.${queueName}`);

  return async (job: Job<JobPayload<T>>): Promise<void> => {
    const payload = job.data;
    const obs: SerializedBusinessContext = payload._obs ?? {
      correlationId: uuidV4(),
    };
    const activeSpan = trace.getSpan(otelCtx.active());
    activeSpan?.setAttributes({
      [SpanAttributes.CORRELATION_ID]: obs.correlationId,
      [SpanAttributes.JOB_QUEUE]: queueName,
      [SpanAttributes.JOB_NAME]: job.name,
      [SpanAttributes.JOB_ID]: String(job.id ?? ''),
      [SpanAttributes.JOB_ATTEMPT]: job.attemptsMade,
      ...(obs.causationId ? { [SpanAttributes.CAUSATION_ID]: obs.causationId } : {}),
      ...(obs.actorUserId ? { [SpanAttributes.ACTOR_USER_ID]: obs.actorUserId } : {}),
      ...(obs.actorStoreId ? { [SpanAttributes.ACTOR_STORE_ID]: obs.actorStoreId } : {}),
    });
    const observationCtx: ObservationContext = {
      correlationId: obs.correlationId,
      causationId: obs.causationId,
      idempotencyKey: obs.idempotencyKey,
      actor: obs.actorUserId
        ? {
            userId: obs.actorUserId,
            storeId: obs.actorStoreId ?? '',
            role: obs.actorRole ?? '',
          }
        : undefined,
    };
    return observationStorage.run(observationCtx, async () => {
      const startMs = performance.now();
      log.log('Job started', {
        jobName: job.name,
        jobId: job.id,
        attempt: job.attemptsMade,
      });

      try {
        await processor(job, payload.data);
        log.log('Job completed', {
          jobName: job.name,
          jobId: job.id,
          durationMs: performance.now() - startMs,
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        log.error('Job failed', {
          jobName: job.name,
          jobId: job.id,
          attempt: job.attemptsMade,
          durationMs: performance.now() - startMs,
          errorMessage: error.message,
        });
        throw err;
      }
    });
  };
}
