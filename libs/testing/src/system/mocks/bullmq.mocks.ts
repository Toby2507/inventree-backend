import { Queue } from 'bullmq';

export const makeQueueMock = (name: string = 'notifications') => {
  return {
    add: jest.fn(),
    name,
  } as unknown as jest.Mocked<Queue>;
};
