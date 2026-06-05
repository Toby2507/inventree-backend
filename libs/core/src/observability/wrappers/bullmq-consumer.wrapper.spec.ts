import { Fn } from '@app/common/types';
import { createOtelTestHarness, makeLoggerMock } from '@app/testing/core/observability';
import { fsJob } from '@app/testing/system';
import { faker } from '@app/testing/utils';
import { SpanAttributes } from '../tracing/span-attributes';
import { createObservedProcessor } from './bullmq-consumer.wrapper';

const generatedUUID = faker.string.uuid();
const mockObservationRun = jest.fn((_ctx, fn) => fn());

jest.mock('uuid', () => ({
  v4: jest.fn(() => generatedUUID),
}));
jest.mock('../context/observation-context.storage', () => ({
  observationStorage: { run: jest.fn((_ctx, fn) => mockObservationRun(_ctx, fn)) },
}));

describe('createObservedProcessor()', () => {
  let processor: jest.Mock;
  let observed: Fn;

  const otel = createOtelTestHarness();
  const job = fsJob.generate();
  const { logger, contextLogger } = makeLoggerMock();

  beforeEach(() => {
    jest.clearAllMocks();
    processor = jest.fn().mockResolvedValue(undefined);
    observed = createObservedProcessor('notifications', logger, processor);
  });

  describe('Context and Span Restoration', () => {
    it('should generate and propagate a fallback correlationId across tracing and observation context', async () => {
      const jobWithoutObs = fsJob.generate({ data: { ...job.data, _obs: undefined } });
      await observed(jobWithoutObs);
      expect(otel.span.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({ [SpanAttributes.CORRELATION_ID]: generatedUUID }),
      );
      expect(mockObservationRun).toHaveBeenCalledWith(
        expect.objectContaining({ correlationId: generatedUUID }),
        expect.any(Function),
      );
    });

    it('should fetch the active span and set business attributes', async () => {
      await observed(job);
      expect(otel.span.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          [SpanAttributes.JOB_QUEUE]: 'notifications',
          [SpanAttributes.JOB_NAME]: job.name,
          [SpanAttributes.JOB_ID]: job.id,
          [SpanAttributes.JOB_ATTEMPT]: job.attemptsMade,
        }),
      );
    });

    it('should restore ObservationContext in ALS', async () => {
      await observed(job);
      expect(mockObservationRun).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: job.data._obs?.correlationId,
          actor: expect.objectContaining({ userId: job.data._obs?.actorUserId }),
        }),
        expect.any(Function),
      );
    });
  });

  describe('Processor Execution', () => {
    it('should call the wrapped processor with the job and its data', async () => {
      await observed(job);
      expect(processor).toHaveBeenCalledWith(job, job.data.data);
    });

    it('should process jobs without the observation metadata', async () => {
      const jobWithoutObs = fsJob.generate({ data: { ...job.data, _obs: undefined } });
      await observed(jobWithoutObs);
      expect(processor).toHaveBeenCalled();
    });

    it('should call the processor within the observationStorage.run context', async () => {
      let isProcessed = false;
      processor.mockImplementationOnce(() => {
        isProcessed = true;
      });
      mockObservationRun.mockImplementationOnce(async (_ctx, fn) => {
        expect(isProcessed).toBe(false);
        const result = await fn();
        expect(isProcessed).toBe(true);
        return result;
      });
      await observed(job);
    });

    it('should log job started and completed on success', async () => {
      await observed(job);
      expect(contextLogger.log).toHaveBeenCalledWith(
        'Job started',
        expect.objectContaining({ jobName: job.name, jobId: job.id }),
      );
      expect(contextLogger.log).toHaveBeenCalledWith(
        'Job completed',
        expect.objectContaining({ jobName: job.name, durationMs: expect.any(Number) }),
      );
    });

    it('should rethrow processor error and log job failed', async () => {
      const error = new Error('processor failed');
      processor.mockRejectedValueOnce(error);
      await expect(observed(job)).rejects.toThrow('processor failed');
      expect(contextLogger.error).toHaveBeenCalledWith(
        'Job failed',
        expect.objectContaining({ errorMessage: 'processor failed' }),
      );
    });

    it('should log processor completion status after calling the processor', async () => {
      const events: string[] = [];
      processor.mockImplementationOnce(async () => {
        events.push('processor called');
      });
      contextLogger.log.mockImplementation((message) => {
        events.push(message);
      });
      await observed(job);
      expect(events).toEqual(['Job started', 'processor called', 'Job completed']);
    });
  });
});
