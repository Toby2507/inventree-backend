import { QUEUE_NAMES, type QueueName } from '@app/core/infrastructure/queue';
import { OBSERVED_QUEUE } from '@app/core/infrastructure/queue/queue.token';
import { makeQueueMock } from '@app/testing/system';
import { Test, type TestingModule } from '@nestjs/testing';
import { QueueMappingService } from './queue-mapper';

describe('QueueMappingService', () => {
  let module: TestingModule;
  let mapper: QueueMappingService;

  const emailQueue = makeQueueMock(QUEUE_NAMES.EMAIL);

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        QueueMappingService,
        { provide: OBSERVED_QUEUE(QUEUE_NAMES.EMAIL), useValue: emailQueue },
      ],
    }).compile();
    mapper = module.get(QueueMappingService);
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterAll(async () => {
    await module.close();
  });

  it.each([[QUEUE_NAMES.EMAIL, emailQueue]])(
    'should resolve %s queue correctly',
    (name, expected) => {
      expect(mapper.get(name)).toBe(expected);
    },
  );

  it('should throw if queue is not registered', () => {
    expect(() => mapper.get('UNKNOWN_QUEUE' as QueueName)).toThrow(/No queue registered/);
  });

  it('should support all queues defined in QUEUE_NAMES', () => {
    const missing: QueueName[] = [];
    for (const name of Object.values(QUEUE_NAMES)) {
      try {
        mapper.get(name);
      } catch {
        missing.push(name);
      }
    }
    expect(missing).toEqual([]);
  });
});
