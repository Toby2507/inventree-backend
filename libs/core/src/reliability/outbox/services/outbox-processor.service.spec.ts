import { ID_GENERATOR } from '@app/core/generators';
import { LOGGER } from '@app/core/observability';
import { DATABASE_CONTEXT, DATABASE_PROVIDER } from '@app/database';
import { faker } from '@app/testing';
import { makeIdGeneratorMock } from '@app/testing/core/generators';
import { createOtelTestHarness, makeLoggerMock } from '@app/testing/core/observability';
import {
  fsOutboxEvent,
  makeEventRouterMock,
  makeOutboxRepositoryMock,
  makeQueueMapperMock,
} from '@app/testing/core/reliability/outbox';
import { makeDatabaseContextMock, makeDatabaseProviderMock } from '@app/testing/database';
import { Test, TestingModule } from '@nestjs/testing';
import { EVENT_ROUTER } from '../ports/event-router.port';
import { QUEUE_MAPPER } from '../ports/queue-mapper.port';
import { OUTBOX_REPOSITORY } from '../ports/repository.port';
import { OutboxEvent } from '../types/outbox.interface';
import { OutboxProcessorService } from './outbox-processor.service';
import { QUEUE_NAMES } from '@app/core/infrastructure/queue';

const FIXED_UUID = faker.string.uuid();

describe('OutboxProcessorService', () => {
  let module: TestingModule;
  let service: OutboxProcessorService;

  createOtelTestHarness();
  const idGenerator = makeIdGeneratorMock();
  idGenerator.generateUUIDV4.mockReturnValue(FIXED_UUID);
  const eventRouter = makeEventRouterMock();
  const dbContext = makeDatabaseContextMock();
  const repository = makeOutboxRepositoryMock();
  const dbProvider = makeDatabaseProviderMock();
  const { logger, contextLogger } = makeLoggerMock();
  const { queue, queueMapper } = makeQueueMapperMock();

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        OutboxProcessorService,
        { provide: LOGGER, useValue: logger },
        { provide: ID_GENERATOR, useValue: idGenerator },
        { provide: EVENT_ROUTER, useValue: eventRouter },
        { provide: QUEUE_MAPPER, useValue: queueMapper },
        { provide: DATABASE_CONTEXT, useValue: dbContext },
        { provide: DATABASE_PROVIDER, useValue: dbProvider },
        { provide: OUTBOX_REPOSITORY, useValue: repository },
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

  describe('on application startup', () => {
    beforeEach(async () => {
      await service.onApplicationBootstrap();
    });

    it('should log startup with the instance id', () => {
      expect(contextLogger.log).toHaveBeenCalledWith('Outbox processor started', {
        instanceId: FIXED_UUID,
      });
    });

    it('should register a notification handler', () => {
      expect(dbProvider.notificationClient.on).toHaveBeenCalledWith(
        'notification',
        expect.any(Function),
      );
    });

    it('should log when a notification is received', async () => {
      const notificationHandler = dbProvider.notificationClient.on.mock.calls[0][1];
      repository.claimBatch.mockResolvedValue([]);
      await notificationHandler({ channel: 'outbox_pending', payload: '123' });
      expect(repository.claimBatch).toHaveBeenCalled();
    });

    it('should subscribe to outbox_pending notifications', () => {
      expect(dbProvider.notificationClient.query).toHaveBeenCalledWith('LISTEN outbox_pending');
    });

    it("should log that it's listening for notifications", () => {
      expect(contextLogger.log).toHaveBeenCalledWith('Listening for outbox notifications');
    });
  });

  describe('handling simultaneous polls', () => {
    it('should skip processing when already polling', async () => {
      let resolveFirst: () => void;
      repository.claimBatch.mockReturnValueOnce(
        new Promise<OutboxEvent[]>((res) => {
          resolveFirst = () => res([]);
        }),
      );
      const first = service.poll(); // starts polling, claimBatch is hanging
      await service.poll(); // second call — must be a no-op
      expect(repository.claimBatch).toHaveBeenCalledTimes(1);
      resolveFirst!();
      await first;
    });

    it('should reset isPolling after successful run', async () => {
      repository.claimBatch.mockResolvedValueOnce([]);
      await service.poll();
      await service.poll(); // if isPolling was stuck, claimBatch would be called only once
      expect(repository.claimBatch).toHaveBeenCalledTimes(2);
    });

    it('should reset isPolling even when processBatch throws', async () => {
      repository.claimBatch.mockRejectedValueOnce(new Error('DB down'));
      await service.poll();
      // isPolling must be reset; this second poll should proceed
      repository.claimBatch.mockResolvedValueOnce([]);
      await service.poll();
      expect(repository.claimBatch).toHaveBeenCalledTimes(2);
    });

    it('should log unexpected polling failures', async () => {
      repository.claimBatch.mockRejectedValueOnce(new Error('DB down'));
      await service.poll();
      expect(contextLogger.error).toHaveBeenCalledWith(
        'Outbox poll failed',
        expect.objectContaining({ message: 'DB down' }),
      );
    });
  });

  describe('when outbox event processing is successful', () => {
    describe('when no event rows are claimed', () => {
      it('should not try to mark as published', async () => {
        repository.claimBatch.mockResolvedValueOnce([]);
        await service.poll();
        expect(repository.markPublished).not.toHaveBeenCalled();
      });
    });

    describe('when event rows are claimed', () => {
      let event: OutboxEvent;

      beforeEach(() => {
        event = fsOutboxEvent.generate();
        repository.claimBatch.mockResolvedValue([event]);
      });

      describe('when atleast one route is configured for the event type', () => {
        beforeEach(() => {
          eventRouter.resolve.mockReturnValue([
            { queue: QUEUE_NAMES.NOTIFICATIONS, jobName: 'user.created' },
          ]);
        });

        it('should add the event to the resolved queue', async () => {
          await service.poll();
          expect(queue.add).toHaveBeenCalledWith(
            'user.created',
            (event.payload as any).data,
            expect.objectContaining({ attempts: 3 }),
          );
        });

        it('should add the event to the resolved queue with event name if job name is absent', async () => {
          eventRouter.resolve.mockReturnValue([{ queue: QUEUE_NAMES.NOTIFICATIONS }]);
          await service.poll();
          expect(queue.add).toHaveBeenCalledWith(
            event.eventType,
            (event.payload as any).data,
            expect.objectContaining({ attempts: 3 }),
          );
        });

        it('should mark the event as published in the repository', async () => {
          await service.poll();
          expect(repository.markPublished).toHaveBeenCalledWith(
            dbContext.operational,
            [event.id],
            FIXED_UUID,
          );
        });

        it('should dispatch to multiple queues when router returns several routes', async () => {
          eventRouter.resolve.mockReturnValue([
            { queue: QUEUE_NAMES.NOTIFICATIONS, jobName: 'notify.user.created' },
            { queue: QUEUE_NAMES.ANALYTICS, jobName: 'track.user.created' },
          ]);
          await service.poll();
          expect(queue.add).toHaveBeenCalledTimes(2);
        });
      });

      describe('when no route is configured for the event type', () => {
        beforeEach(() => {
          eventRouter.resolve.mockReturnValue([]);
        });

        it('should skip queuing and mark the event as published', async () => {
          await service.poll();
          expect(queue.add).not.toHaveBeenCalled();
          expect(repository.markPublished).toHaveBeenCalledWith(
            dbContext.operational,
            [event.id],
            FIXED_UUID,
          );
        });

        it('should log that the event queuing is being skipped', async () => {
          await service.poll();
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
      eventRouter.resolve.mockReturnValue([
        { queue: QUEUE_NAMES.NOTIFICATIONS, jobName: 'user.created' },
      ]);
      queue.add.mockRejectedValue(new Error('Queue unavailable'));
    });

    describe('on error', () => {
      let event: OutboxEvent;
      beforeEach(() => {
        event = fsOutboxEvent.generate();
        repository.claimBatch.mockResolvedValueOnce([event]);
      });

      it('should mark event as failed with the error message', async () => {
        await service.poll();
        expect(repository.markFailed).toHaveBeenCalledWith(
          dbContext.operational,
          event.id,
          'Queue unavailable',
          expect.any(Date),
          expect.any(Boolean),
        );
      });

      it('should mark the event as failed when markPublished fails', async () => {
        queue.add.mockResolvedValue('ok' as any);
        repository.markPublished.mockRejectedValue(new Error('DB down'));
        await service.poll();
        expect(repository.markFailed).toHaveBeenCalled();
      });

      it('should log the error when event processing fails', async () => {
        queue.add.mockResolvedValue('ok' as any);
        repository.markPublished.mockRejectedValue(new Error('DB down'));
        await service.poll();
        expect(contextLogger.error).toHaveBeenCalledWith(
          'Outbox event publish failed',
          expect.objectContaining({
            eventType: event.eventType,
            eventId: event.id,
            message: 'DB down',
          }),
        );
      });

      it('should log the error if marking failed events fails', async () => {
        repository.markFailed.mockRejectedValue(new Error('DB down'));
        await service.poll();
        expect(contextLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Unexpected processRow rejections'),
          expect.objectContaining({ reasons: ['DB down'] }),
        );
      });
    });

    describe('handling backoff calculations', () => {
      const BASE_BACKOFF_MS = 5_000;
      const MAX_BACKOFF_MS = 5 * 60 * 1_000;

      beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it.each([
        { publishAttempts: 0, expectedDelayMs: BASE_BACKOFF_MS * 2 ** 0 }, // 5 000
        { publishAttempts: 1, expectedDelayMs: BASE_BACKOFF_MS * 2 ** 1 }, // 10 000
        { publishAttempts: 2, expectedDelayMs: BASE_BACKOFF_MS * 2 ** 2 }, // 20 000
        { publishAttempts: 3, expectedDelayMs: BASE_BACKOFF_MS * 2 ** 3 }, // 40 000
      ])(
        'should calculate nextAttemptAt as ~$expectedDelayMs ms in the future for attempt $publishAttempts',
        async ({ publishAttempts, expectedDelayMs }) => {
          repository.claimBatch.mockResolvedValueOnce(
            fsOutboxEvent.generateMany(1, { publishAttempts }),
          );
          const expectedNextAttempt = new Date(Date.now() + expectedDelayMs);
          await service.poll();
          const [, , , nextAttemptAt] = repository.markFailed.mock.calls.at(-1)!;
          expect(nextAttemptAt).toEqual(expectedNextAttempt);
        },
      );

      it('should cap delay at MAX_BACKOFF_MS when attempts are very high', async () => {
        repository.claimBatch.mockResolvedValueOnce(
          fsOutboxEvent.generateMany(1, { publishAttempts: 99 }),
        );
        const expectedNextAttempt = new Date(Date.now() + MAX_BACKOFF_MS);
        await service.poll();
        const [, , , nextAttemptAt] = repository.markFailed.mock.calls.at(-1)!;
        expect(nextAttemptAt).toEqual(expectedNextAttempt);
      });
    });

    describe('handling dead-letter escalation', () => {
      const MAX_PUBLISH_ATTEMPTS = 5;

      it.each(Array.from({ length: MAX_PUBLISH_ATTEMPTS - 1 }, (_, i) => i))(
        'should mark deadLetter = false at attempt %i',
        async (publishAttempts) => {
          repository.claimBatch.mockResolvedValue(
            fsOutboxEvent.generateMany(1, { publishAttempts }),
          );
          await service.poll();
          const deadLetter = repository.markFailed.mock.calls[0][4];
          expect(deadLetter).toBe(false);
        },
      );

      it(`should mark as deadletter on failure number ${MAX_PUBLISH_ATTEMPTS}`, async () => {
        repository.claimBatch.mockResolvedValue(
          fsOutboxEvent.generateMany(1, { publishAttempts: MAX_PUBLISH_ATTEMPTS - 1 }),
        );
        await service.poll();
        const deadLetter = repository.markFailed.mock.calls[0][4];
        expect(deadLetter).toBe(true);
      });
    });
  });

  describe('when batch processing', () => {
    beforeEach(() => {
      repository.markPublished.mockResolvedValue();
      repository.markFailed.mockResolvedValue();
    });

    it('should process all rows in the batch even when some fail', async () => {
      repository.claimBatch.mockResolvedValue(fsOutboxEvent.generateMany(3));
      eventRouter.resolve.mockReturnValue([
        { queue: QUEUE_NAMES.NOTIFICATIONS, jobName: 'user.created' },
      ]);
      queue.add
        .mockResolvedValueOnce('ok' as any)
        .mockRejectedValueOnce(new Error('Transient'))
        .mockResolvedValueOnce('ok' as any);
      await service.poll();
      expect(repository.markPublished).toHaveBeenCalledTimes(2);
      expect(repository.markFailed).toHaveBeenCalledTimes(1);
    });

    it('should process a mixed batch correctly', async () => {
      const [success1, failure, unrouted, success2] = fsOutboxEvent.generateMany(4);
      repository.claimBatch.mockResolvedValue([success1, failure, unrouted, success2]);
      eventRouter.resolve
        .mockReturnValueOnce([{ queue: QUEUE_NAMES.NOTIFICATIONS, jobName: 'success1' }])
        .mockReturnValueOnce([{ queue: QUEUE_NAMES.NOTIFICATIONS, jobName: 'failure' }])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([
          { queue: QUEUE_NAMES.NOTIFICATIONS, jobName: 'success2' },
          { queue: QUEUE_NAMES.ANALYTICS, jobName: 'success2' },
        ]);
      queue.add
        .mockResolvedValueOnce('ok' as any)
        .mockRejectedValueOnce(new Error('Queue unavailable'))
        .mockResolvedValue('ok' as any);
      await service.poll();
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
        expect.any(Date),
        expect.any(Boolean),
      );
    });
  });

  describe('when releasing expired locks', () => {
    it('should delegate to the repository with the operational context', async () => {
      await service.releaseExpiredLocks();
      expect(repository.releaseExpiredLocks).toHaveBeenCalledWith(dbContext.operational);
    });
  });
});
