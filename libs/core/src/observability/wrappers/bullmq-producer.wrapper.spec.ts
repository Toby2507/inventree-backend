import { fsObservationContext, makeLoggerMock, makeQueueMock } from '@app/testing';
import { observationStorage } from '../context/observation-context.storage';
import { ObservedQueueWrapper } from './bullmq-producer.wrapper';
import { Queue } from 'bullmq';

describe('ObservedQueueWrapper', () => {
  let queue: jest.Mocked<Queue>;
  let wrapper: ObservedQueueWrapper;
  const ctx = fsObservationContext.generate();
  const { logger, contextLogger } = makeLoggerMock();

  const getQueueCall = () => {
    const call = queue.add.mock.calls[0];
    return { jobName: call[0], payload: call[1], opts: call[2] };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    queue = makeQueueMock();
    wrapper = new ObservedQueueWrapper(queue, logger);
  });

  it('should enqueue jobs with the business data wrapped in JobPayload', async () => {
    await wrapper.add('send-email', { to: 'user@example.com' });
    const { jobName, payload } = getQueueCall();
    expect(jobName).toBe('send-email');
    expect(payload.data).toEqual({ to: 'user@example.com' });
    expect(payload._obs).toBeUndefined();
  });

  it('should enqueue jobs with serialized ObservationContext embedded in _obs field when available', async () => {
    await observationStorage.run(ctx, async () => {
      await wrapper.add('send-email', { to: 'user@example.com' });
    });
    const { payload } = getQueueCall();
    expect(payload._obs.correlationId).toBe(ctx.correlationId);
    expect(payload._obs.causationId).toBe(ctx.causationId);
  });

  it('should forward BullMQ options (delay, attempts, etc.) to queue.add', async () => {
    await wrapper.add('send-email', {}, { delay: 5000, attempts: 3 });
    const { opts } = getQueueCall();
    expect(opts).toEqual({ delay: 5000, attempts: 3 });
  });

  it('should log debug message with queue name, job name, and correlationId', async () => {
    await observationStorage.run(ctx, async () => {
      await wrapper.add('send-email', { to: 'user@example.com' });
    });
    expect(contextLogger.debug).toHaveBeenCalledWith('Job enqueued', {
      queue: queue.name,
      jobName: 'send-email',
      correlationId: ctx.correlationId,
    });
  });

  it('should rethrow queue errors', async () => {
    queue.add.mockRejectedValueOnce(new Error('redis down'));
    await expect(wrapper.add('send-email', {})).rejects.toThrow('redis down');
  });
});
