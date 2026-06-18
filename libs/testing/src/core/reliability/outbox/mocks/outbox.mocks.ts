import { EventRouterPort, QueueMapperPort } from '@app/core/reliability/outbox';
import { makeQueueMock } from '@app/testing/system';

export const makeQueueMapperMock = () => {
  const queue = makeQueueMock();
  const queueMapper = {
    get: jest.fn().mockReturnValue(queue),
  } as unknown as jest.Mocked<QueueMapperPort>;
  return { queue, queueMapper };
};

export const makeEventRouterMock = () => {
  return {
    resolve: jest.fn(),
  } as unknown as jest.Mocked<EventRouterPort>;
};
