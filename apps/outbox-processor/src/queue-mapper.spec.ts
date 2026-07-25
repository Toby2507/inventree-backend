import { QUEUE_NAMES, type QueueName } from '@app/core/infrastructure/queue';
import { makeQueueMock } from '@app/testing/system';
import { getQueueToken } from '@nestjs/bullmq';
import { Test, type TestingModule } from '@nestjs/testing';
import { QueueMappingService } from './queue-mapper';

describe('QueueMappingService', () => {
  let module: TestingModule;
  let mapper: QueueMappingService;

  const notificationQueue = makeQueueMock(QUEUE_NAMES.NOTIFICATIONS);
  const inventoryQueue = makeQueueMock(QUEUE_NAMES.INVENTORY);
  const analyticsQueue = makeQueueMock(QUEUE_NAMES.ANALYTICS);
  const billingQueue = makeQueueMock(QUEUE_NAMES.BILLING);
  const reportQueue = makeQueueMock(QUEUE_NAMES.REPORTS);
  const emailQueue = makeQueueMock(QUEUE_NAMES.EMAIL);

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        QueueMappingService,
        { provide: getQueueToken(QUEUE_NAMES.NOTIFICATIONS), useValue: notificationQueue },
        { provide: getQueueToken(QUEUE_NAMES.INVENTORY), useValue: inventoryQueue },
        { provide: getQueueToken(QUEUE_NAMES.ANALYTICS), useValue: analyticsQueue },
        { provide: getQueueToken(QUEUE_NAMES.BILLING), useValue: billingQueue },
        { provide: getQueueToken(QUEUE_NAMES.REPORTS), useValue: reportQueue },
        { provide: getQueueToken(QUEUE_NAMES.EMAIL), useValue: emailQueue },
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

  it.each([
    [QUEUE_NAMES.NOTIFICATIONS, notificationQueue],
    [QUEUE_NAMES.INVENTORY, inventoryQueue],
    [QUEUE_NAMES.ANALYTICS, analyticsQueue],
    [QUEUE_NAMES.BILLING, billingQueue],
    [QUEUE_NAMES.REPORTS, reportQueue],
    [QUEUE_NAMES.EMAIL, emailQueue],
  ])('should resolve %s queue correctly', (name, expected) => {
    expect(mapper.get(name)).toBe(expected);
  });

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
