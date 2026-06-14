import { Test, TestingModule } from '@nestjs/testing';
import { OutboxService } from './outbox.service';
import { feOutboxEvent, makeOutboxRepositoryMock } from '@app/testing/core/reliability/outbox';
import { OUTBOX_REPOSITORY } from '../ports/repository.port';
import { makeDatabaseContextMock } from '@app/testing/system';
import { createOtelTestHarness, fsObservationContext } from '@app/testing/core/observability';
import { observationStorage } from '@app/core/observability/context/observation-context.storage';
import { faker } from '@app/testing';

describe('OutboxService', () => {
  let module: TestingModule;
  let service: OutboxService;

  const dbContext = makeDatabaseContextMock();
  const repository = makeOutboxRepositoryMock();
  const otel = createOtelTestHarness();
  const observationContext = fsObservationContext.generate();

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [OutboxService, { provide: OUTBOX_REPOSITORY, useValue: repository }],
    }).compile();
    await module.init();
    service = module.get(OutboxService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    jest.clearAllMocks();
    await module.close();
  });

  describe('publishAll', () => {
    it('should do nothing if events are empty', async () => {
      await service.publishAll(dbContext.operational, []);
      expect(repository.insert).not.toHaveBeenCalled();
    });

    it('should insert events into the outbox table and inject observability context', async () => {
      const events = feOutboxEvent.generateMany(2);
      const spanContext = {
        traceId: faker.string.uuid(),
        spanId: faker.string.uuid(),
      };
      otel.span.spanContext.mockReturnValue(spanContext);
      await observationStorage.run(observationContext, async () => {
        await service.publishAll(dbContext.operational, events);
        expect(repository.insert).toHaveBeenCalledWith(
          dbContext.operational,
          expect.objectContaining({
            events,
            ctx: {
              serialized: expect.objectContaining({
                correlationId: observationContext.correlationId,
              }),
              traceId: spanContext.traceId,
              spanId: spanContext.spanId,
            },
          }),
        );
      });
    });

    it('should insert events without observability context if not available', async () => {
      const events = feOutboxEvent.generateMany(2);
      otel.spies.getActiveSpan.mockReturnValue(undefined);
      await service.publishAll(dbContext.operational, events);
      expect(repository.insert).toHaveBeenCalledWith(
        dbContext.operational,
        expect.objectContaining({
          events,
          ctx: {},
        }),
      );
    });
  });
});
