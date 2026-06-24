import { Test, TestingModule } from '@nestjs/testing';
import { QueueMapper } from './queue-mapper';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUE_NAMES, QueueName } from '@app/core/infrastructure/queue';
import { makeQueueMock } from '@app/testing/system';

describe('QueueMapper', () => {
  let module: TestingModule;
  let mapper: QueueMapper;

  const notificationQueue = makeQueueMock(QUEUE_NAMES.NOTIFICATIONS);
  const inventoryQueue = makeQueueMock(QUEUE_NAMES.INVENTORY);
  const analyticsQueue = makeQueueMock(QUEUE_NAMES.ANALYTICS);
  const billingQueue = makeQueueMock(QUEUE_NAMES.BILLING);
  const reportQueue = makeQueueMock(QUEUE_NAMES.REPORTS);

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        QueueMapper,
        { provide: getQueueToken(QUEUE_NAMES.NOTIFICATIONS), useValue: notificationQueue },
        { provide: getQueueToken(QUEUE_NAMES.INVENTORY), useValue: inventoryQueue },
        { provide: getQueueToken(QUEUE_NAMES.ANALYTICS), useValue: analyticsQueue },
        { provide: getQueueToken(QUEUE_NAMES.BILLING), useValue: billingQueue },
        { provide: getQueueToken(QUEUE_NAMES.REPORTS), useValue: reportQueue },
      ],
    }).compile();
    mapper = module.get(QueueMapper);
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
