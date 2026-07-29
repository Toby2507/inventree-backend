import { ID_GENERATOR } from '@app/core/generators';
import { QUEUE_NAMES, QueueName } from '@app/core/infrastructure/queue';
import { LOGGER } from '@app/core/observability';
import { DATABASE_CONTEXT, DATABASE_LISTENER, LISTEN_CHANNELS } from '@app/database';
import { faker } from '@app/testing';
import { makeIdGeneratorMock } from '@app/testing/core/generators';
import { createOtelTestHarness, makeLoggerMock } from '@app/testing/core/observability';
import {
  fsOutboxEvent,
  makeEventRouterMock,
  makeOutboxRepositoryMock,
  makeQueueMapperMock,
} from '@app/testing/core/reliability/outbox';
import { makeDatabaseContextMock, makeDatabaseListenerMock } from '@app/testing/database';
import { Test, type TestingModule } from '@nestjs/testing';
import { EVENT_ROUTER } from '../ports/event-router.port';
import { QUEUE_MAPPER } from '../ports/queue-mapper.port';
import { OUTBOX_REPOSITORY } from '../ports/repository.port';
import type { OutboxEvent } from '../types/outbox.interface';
import { OutboxProcessorService } from './outbox-processor.service';
import { Duration, Instant } from '@app/shared-kernel';

const FIXED_UUID = faker.string.uuid();

const flushPromises = () => new Promise(setImmediate);
const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('OutboxProcessorService', () => {
  let module: TestingModule;
  let service: OutboxProcessorService;

  createOtelTestHarness();
  const idGenerator = makeIdGeneratorMock();
  idGenerator.generateUUIDV4.mockReturnValue(FIXED_UUID);
  const eventRouter = makeEventRouterMock();
  const dbContext = makeDatabaseContextMock();
  const repository = makeOutboxRepositoryMock();
  const dbListener = makeDatabaseListenerMock();
  const { logger, contextLogger } = makeLoggerMock();
  const { queue, queueMapper } = makeQueueMapperMock();

  const trigger = (): Promise<void> => (service as any).triggerProcessing();

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        OutboxProcessorService,
        { provide: LOGGER, useValue: logger },
        { provide: ID_GENERATOR, useValue: idGenerator },
        { provide: EVENT_ROUTER, useValue: eventRouter },
        { provide: QUEUE_MAPPER, useValue: queueMapper },
        { provide: DATABASE_CONTEXT, useValue: dbContext },
        { provide: OUTBOX_REPOSITORY, useValue: repository },
        { provide: DATABASE_LISTENER, useValue: dbListener },
      ],
    }).compile();
    service = module.get(OutboxProcessorService);
    await module.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await module.close();
  });

  describe('construction', () => {
    it('should generate a stable instance id once and namespace the logger', async () => {
      const localIdGenerator = makeIdGeneratorMock();
      localIdGenerator.generateUUIDV4.mockReturnValue('local-instance-id');
      const { logger: localLogger } = makeLoggerMock();
      const localModule = await Test.createTestingModule({
        providers: [
          OutboxProcessorService,
          { provide: LOGGER, useValue: localLogger },
          { provide: ID_GENERATOR, useValue: localIdGenerator },
          { provide: EVENT_ROUTER, useValue: eventRouter },
          { provide: QUEUE_MAPPER, useValue: queueMapper },
          { provide: DATABASE_CONTEXT, useValue: dbContext },
          { provide: OUTBOX_REPOSITORY, useValue: repository },
          { provide: DATABASE_LISTENER, useValue: dbListener },
        ],
      }).compile();
      await localModule.init();
      expect(localIdGenerator.generateUUIDV4).toHaveBeenCalledTimes(1);
      expect(localLogger.forContext).toHaveBeenCalledWith(OutboxProcessorService.name);
      await localModule.close();
    });
  });

  describe('on application bootstrap', () => {
    it('should log startup and subscribe to outbox pending channel', async () => {
      await service.onApplicationBootstrap();
      expect(contextLogger.log).toHaveBeenCalledWith('Outbox processor started', {
        instanceId: FIXED_UUID,
      });
      expect(dbListener.subscribe).toHaveBeenCalledWith(
        LISTEN_CHANNELS.OUTBOX_PENDING,
        OutboxProcessorService.name,
        expect.any(Function),
      );
    });

    it('should trigger processing when the listener callback is invoked', async () => {
      repository.claimBatch.mockResolvedValueOnce([]);
      await service.onApplicationBootstrap();
      const callback = dbListener.subscribe.mock.calls[0][2];
      callback();
      await flushPromises();
      expect(repository.claimBatch).toHaveBeenCalledTimes(1);
    });

    it('should not let a rejected processing pass throw to the listener', async () => {
      repository.claimBatch.mockRejectedValueOnce(new Error('DB down'));
      await service.onApplicationBootstrap();
      const callback = dbListener.subscribe.mock.calls[0][2];
      expect(() => callback()).not.toThrow();
      await flushPromises();
    });
  });

  describe('scheduled jobs', () => {
    describe('retrying due events', () => {
      it('should trigger the processing when the cron job runs', async () => {
        repository.claimBatch.mockResolvedValueOnce([]);
        await service.retryDueEvents();
        expect(repository.claimBatch).toHaveBeenCalledTimes(1);
      });
    });

    describe('releasing expired locks', () => {
      it('should release expired locks and log a warning if any are found', async () => {
        repository.releaseExpiredLocks.mockResolvedValueOnce(3);
        await service.releaseExpiredLocks();
        expect(repository.releaseExpiredLocks).toHaveBeenCalledWith(dbContext.operational);
        expect(contextLogger.warn).toHaveBeenCalledWith('Released expired outbox locks', {
          count: 3,
          instanceId: FIXED_UUID,
        });
      });

      it('should not log a warning if no expired locks are found', async () => {
        repository.releaseExpiredLocks.mockResolvedValueOnce(0);
        await service.releaseExpiredLocks();
        expect(contextLogger.warn).not.toHaveBeenCalled();
      });
    });
  });

  describe('event claiming pipeline: triggerProcessing -> drain -> processBatch', () => {
    it('should claim a batch with the configured batch size, instance id, and lock duration', async () => {
      repository.claimBatch.mockResolvedValueOnce([]);
      await trigger();
      expect(repository.claimBatch).toHaveBeenCalledWith(
        dbContext.operational,
        service['BATCH_SIZE'],
        FIXED_UUID,
        service['LOCK_DURATION'].toMs(),
      );
    });

    it('should log the claimed batch size', async () => {
      repository.claimBatch
        .mockResolvedValueOnce(fsOutboxEvent.generateMany(3))
        .mockResolvedValue([]);
      eventRouter.resolve.mockReturnValue([]);
      await trigger();
      expect(contextLogger.debug).toHaveBeenCalledWith('Claimed outbox batch', {
        count: 3,
        instanceId: FIXED_UUID,
      });
    });

    it('should continue claiming batches until no more rows are returned', async () => {
      repository.claimBatch
        .mockResolvedValueOnce(fsOutboxEvent.generateMany(2))
        .mockResolvedValueOnce(fsOutboxEvent.generateMany(1))
        .mockResolvedValueOnce([]);
      eventRouter.resolve.mockReturnValue([]);
      await trigger();
      expect(repository.claimBatch).toHaveBeenCalledTimes(3);
    });

    it('should continue draining even if every row in a batch fails to publish', async () => {
      repository.claimBatch
        .mockResolvedValueOnce(fsOutboxEvent.generateMany(2))
        .mockResolvedValueOnce([]);
      eventRouter.resolve.mockReturnValue([{ queue: QUEUE_NAMES.EMAIL }]);
      queue.add.mockRejectedValueOnce(new Error('Queue down'));
      await trigger();
      expect(repository.claimBatch).toHaveBeenCalledTimes(2);
    });

    it('should coalesce a trigger that arrives while processing into one extra pass', async () => {
      const firstClaim = createDeferred<OutboxEvent[]>();
      const secondClaim = createDeferred<OutboxEvent[]>();
      repository.claimBatch
        .mockResolvedValueOnce(firstClaim.promise)
        .mockResolvedValueOnce(secondClaim.promise);
      const runA = trigger();
      await flushPromises(); // let it reach the first `await claimBatch()`
      // Triggered again while isProcessing===true: should not call claimBatch again
      // just flag that another pass is needed
      void trigger();
      await flushPromises();
      expect(repository.claimBatch).toHaveBeenCalledTimes(1);
      // Finish the first (empty) drain -> should immediately start a second pass
      // because needsAnotherPass was set to true
      firstClaim.resolve([]);
      await flushPromises();
      expect(repository.claimBatch).toHaveBeenCalledTimes(2);
      secondClaim.resolve([]);
      await runA;
    });

    it('should not overlap drains for triggers received back-to-back multiple times', async () => {
      const claims = [createDeferred<OutboxEvent[]>(), createDeferred<OutboxEvent[]>()];
      let call = 0;
      repository.claimBatch.mockImplementation(
        () => claims[call++]?.promise ?? Promise.resolve([]),
      );
      const runA = trigger();
      await flushPromises();
      void trigger(); // extra pass requested
      void trigger(); // still just 1 extra pass, the flag is idempotent
      await flushPromises();
      claims[0].resolve([]);
      await flushPromises();
      claims[1].resolve([]);
      await runA;
      expect(repository.claimBatch).toHaveBeenCalledTimes(2); // Exactly one re-drain, not one per extra trigger call
    });
  });

  describe('when outbox event processing is successful', () => {
    describe('when no event rows are claimed', () => {
      it('should not try to mark as published', async () => {
        repository.claimBatch.mockResolvedValueOnce([]);
        await trigger();
        expect(repository.markPublished).not.toHaveBeenCalled();
      });
    });

    describe('when event rows are claimed', () => {
      let event: OutboxEvent;
      beforeEach(() => {
        event = fsOutboxEvent.generate();
        repository.claimBatch.mockResolvedValueOnce([event]);
      });

      describe('when atleast one route is configured for the event type', () => {
        beforeEach(() => {
          eventRouter.resolve.mockReturnValue([
            { queue: QUEUE_NAMES.EMAIL, jobName: 'user.created' },
          ]);
        });

        it('should add the event to the resolved queue and mark it as published', async () => {
          await trigger();
          expect(queueMapper.get).toHaveBeenCalledWith(QUEUE_NAMES.EMAIL);
          expect(queue.add).toHaveBeenCalledWith(
            'user.created',
            (event.payload as any).data,
            expect.objectContaining({ jobId: event.id, attempts: 3 }),
          );
          expect(repository.markPublished).toHaveBeenCalledWith(
            dbContext.operational,
            [event.id],
            FIXED_UUID,
          );
        });

        it('should clean the event payload before enqueuing if toPayload is defined', async () => {
          event = fsOutboxEvent.generate({
            payload: {
              data: { firstName: faker.person.firstName(), lastName: faker.person.lastName() },
            },
          });
          repository.claimBatch.mockReset();
          repository.claimBatch.mockResolvedValueOnce([event]);
          eventRouter.resolve.mockReturnValueOnce([
            {
              queue: QUEUE_NAMES.EMAIL,
              toPayload: (pl) => ({ name: `${pl.firstName} ${pl.lastName}` }),
            },
          ]);
          await trigger();
          const eventPayload = (event.payload as any).data;
          expect(queue.add).toHaveBeenCalledWith(
            event.eventType,
            { name: `${eventPayload.firstName} ${eventPayload.lastName}` },
            expect.anything(),
          );
        });

        it('should add the event to the resolved queue with event name if job name is absent', async () => {
          eventRouter.resolve.mockReturnValueOnce([{ queue: QUEUE_NAMES.EMAIL }]);
          await trigger();
          expect(queue.add).toHaveBeenCalledWith(
            event.eventType,
            expect.anything(),
            expect.anything(),
          );
        });

        it('should fan out to every mapped route and marks published once', async () => {
          eventRouter.resolve.mockReturnValue([
            { queue: QUEUE_NAMES.EMAIL, jobName: 'notify.user.created' },
            { queue: 'analytics' as unknown as QueueName, jobName: 'track.user.created' },
          ]);
          await trigger();
          expect(queue.add).toHaveBeenCalledTimes(2);
          expect(repository.markPublished).toHaveBeenCalledTimes(1);
        });
      });

      describe('when no route is configured for the event type', () => {
        beforeEach(() => {
          eventRouter.resolve.mockReturnValue([]);
        });

        it('should skip queuing and mark the event as published', async () => {
          await trigger();
          expect(queue.add).not.toHaveBeenCalled();
          expect(repository.markPublished).toHaveBeenCalledWith(
            dbContext.operational,
            [event.id],
            FIXED_UUID,
          );
        });

        it('should log that the event queuing is being skipped', async () => {
          await trigger();
          expect(contextLogger.log).toHaveBeenCalledWith(
            expect.stringContaining('No route configured for event'),
            expect.objectContaining({ eventType: event.eventType, eventId: event.id }),
          );
        });
      });
    });
  });

  describe('when outbox event processing fails', () => {
    beforeEach(() => {
      eventRouter.resolve.mockReturnValue([{ queue: QUEUE_NAMES.EMAIL, jobName: 'user.created' }]);
      queue.add.mockRejectedValue(new Error('Queue unavailable'));
    });

    describe('on error', () => {
      let event: OutboxEvent;
      beforeEach(() => {
        event = fsOutboxEvent.generate();
        repository.claimBatch.mockResolvedValueOnce([event]);
      });

      it('should mark event as failed with the error message', async () => {
        await trigger();
        expect(repository.markPublished).not.toHaveBeenCalled();
        expect(repository.markFailed).toHaveBeenCalledWith(
          dbContext.operational,
          event.id,
          'Queue unavailable',
          expect.any(Instant),
          expect.any(Boolean),
        );
      });

      it('should treat markPublished failures as a publish failure and log the error', async () => {
        queue.add.mockResolvedValue('ok' as any);
        repository.markPublished.mockRejectedValue(new Error('DB down'));
        await trigger();
        expect(contextLogger.error).toHaveBeenCalledWith(
          'Outbox event publish failed',
          expect.objectContaining({
            eventType: event.eventType,
            eventId: event.id,
            message: 'DB down',
          }),
        );
      });

      it('should stringify non-Error failures that occurs during dispatch', async () => {
        queue.add.mockRejectedValueOnce('Queue down');
        await trigger();
        expect(repository.markFailed).toHaveBeenCalledWith(
          dbContext.operational,
          event.id,
          'Queue down',
          expect.any(Instant),
          expect.any(Boolean),
        );
      });

      it('should log an error when marking an event as failed fails too', async () => {
        repository.markFailed.mockRejectedValueOnce(new Error('DB down'));
        await trigger();
        expect(contextLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Unexpected processRow rejections'),
          expect.objectContaining({ reasons: ['DB down'] }),
        );
      });
    });

    describe('handling backoff calculations', () => {
      const BASE_BACKOFF = Duration.seconds(5);
      const MAX_BACKOFF = Duration.minutes(5);

      beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it.each([
        { publishAttempts: 0, expectedDelayMs: BASE_BACKOFF.toMs() * 2 ** 0 }, // 5 000
        { publishAttempts: 1, expectedDelayMs: BASE_BACKOFF.toMs() * 2 ** 1 }, // 10 000
        { publishAttempts: 2, expectedDelayMs: BASE_BACKOFF.toMs() * 2 ** 2 }, // 20 000
        { publishAttempts: 3, expectedDelayMs: BASE_BACKOFF.toMs() * 2 ** 3 }, // 40 000
        { publishAttempts: 4, expectedDelayMs: BASE_BACKOFF.toMs() * 2 ** 4 }, // 80 000
      ])(
        'should calculate nextAttemptAt as ~$expectedDelayMs ms in the future for attempt $publishAttempts',
        async ({ publishAttempts, expectedDelayMs }) => {
          repository.claimBatch.mockResolvedValueOnce(
            fsOutboxEvent.generateMany(1, { publishAttempts }),
          );
          const expectedNextAttempt = Instant.fromEpochMs(Date.now()).plus(
            Duration.milliseconds(expectedDelayMs),
          );
          await trigger();
          const [, , , nextAttemptAt] = repository.markFailed.mock.calls.at(-1)!;
          expect(nextAttemptAt.toEpochMs()).toBe(expectedNextAttempt.toEpochMs());
        },
      );

      it('should cap delay at MAX_BACKOFF_MS when attempts are very high', async () => {
        repository.claimBatch.mockResolvedValueOnce(
          fsOutboxEvent.generateMany(1, { publishAttempts: 99 }),
        );
        const expectedNextAttempt = Instant.fromEpochMs(Date.now()).plus(MAX_BACKOFF);
        await trigger();
        const [, , , nextAttemptAt] = repository.markFailed.mock.calls.at(-1)!;
        expect(nextAttemptAt.toEpochMs()).toBe(expectedNextAttempt.toEpochMs());
      });
    });

    describe('handling dead-letter escalation', () => {
      const MAX_PUBLISH_ATTEMPTS = 5;

      it.each(Array.from({ length: MAX_PUBLISH_ATTEMPTS - 1 }, (_, i) => i))(
        'should mark deadLetter = false at attempt %i',
        async (publishAttempts) => {
          repository.claimBatch.mockResolvedValueOnce(
            fsOutboxEvent.generateMany(1, { publishAttempts }),
          );
          await trigger();
          const deadLetter = repository.markFailed.mock.calls[0][4];
          expect(deadLetter).toBe(false);
        },
      );

      it(`should mark as deadletter on failure number ${MAX_PUBLISH_ATTEMPTS}`, async () => {
        repository.claimBatch.mockResolvedValueOnce(
          fsOutboxEvent.generateMany(1, { publishAttempts: MAX_PUBLISH_ATTEMPTS - 1 }),
        );
        await trigger();
        const deadLetter = repository.markFailed.mock.calls[0][4];
        expect(deadLetter).toBe(true);
      });

      it('should log failure with attempt count and deadletter status', async () => {
        const event = fsOutboxEvent.generate({ publishAttempts: MAX_PUBLISH_ATTEMPTS - 1 });
        repository.claimBatch.mockResolvedValueOnce([event]).mockResolvedValueOnce([]);
        await trigger();
        expect(contextLogger.error).toHaveBeenCalledWith(
          'Outbox event publish failed',
          expect.objectContaining({
            eventType: event.eventType,
            eventId: event.id,
            attempts: MAX_PUBLISH_ATTEMPTS,
            deadLetter: true,
            message: 'Queue unavailable',
          }),
        );
      });
    });
  });

  describe('when batch processing', () => {
    beforeEach(() => {
      repository.markPublished.mockResolvedValue();
      repository.markFailed.mockResolvedValue();
    });

    it('should process all rows in the batch even when some fail', async () => {
      repository.claimBatch.mockResolvedValueOnce(fsOutboxEvent.generateMany(3));
      eventRouter.resolve.mockReturnValue([{ queue: QUEUE_NAMES.EMAIL, jobName: 'user.created' }]);
      queue.add
        .mockResolvedValueOnce('ok' as any)
        .mockRejectedValueOnce(new Error('Transient'))
        .mockResolvedValueOnce('ok' as any);
      await trigger();
      expect(repository.markPublished).toHaveBeenCalledTimes(2);
      expect(repository.markFailed).toHaveBeenCalledTimes(1);
    });

    it('should process a mixed batch correctly', async () => {
      const [success1, failure, unrouted, success2] = fsOutboxEvent.generateMany(4);
      repository.claimBatch.mockResolvedValueOnce([success1, failure, unrouted, success2]);
      eventRouter.resolve
        .mockReturnValueOnce([{ queue: QUEUE_NAMES.EMAIL, jobName: 'success1' }])
        .mockReturnValueOnce([{ queue: QUEUE_NAMES.EMAIL, jobName: 'failure' }])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([
          { queue: QUEUE_NAMES.EMAIL, jobName: 'success2' },
          { queue: 'analytics' as unknown as QueueName, jobName: 'success2' },
        ]);
      queue.add
        .mockResolvedValueOnce('ok' as any)
        .mockRejectedValueOnce(new Error('Queue unavailable'))
        .mockResolvedValue('ok' as any);
      await trigger();
      expect(queue.add).toHaveBeenCalledTimes(4);
      expect(repository.markPublished).toHaveBeenCalledTimes(3);
      expect(repository.markFailed).toHaveBeenCalledTimes(1);
      expect(repository.markPublished).toHaveBeenCalledWith(
        dbContext.operational,
        [success1.id],
        FIXED_UUID,
      );
      expect(repository.markPublished).toHaveBeenCalledWith(
        dbContext.operational,
        [unrouted.id],
        FIXED_UUID,
      );
      expect(repository.markPublished).toHaveBeenCalledWith(
        dbContext.operational,
        [success2.id],
        FIXED_UUID,
      );
      expect(repository.markFailed).toHaveBeenCalledWith(
        dbContext.operational,
        failure.id,
        'Queue unavailable',
        expect.any(Instant),
        expect.any(Boolean),
      );
    });
  });
});
