import { RedisPort } from '@app/core/infrastructure/redis';

export const makeRedisMock = () => {
  return {
    client: {},
    get: jest.fn(),
    set: jest.fn(),
    setNX: jest.fn(),
    del: jest.fn(),
  } as unknown as jest.Mocked<RedisPort>;
};
