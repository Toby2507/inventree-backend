import { HashingPort, UserRepository } from '@app/contexts';

export const makeArgon2HasherMock = (): jest.Mocked<HashingPort> => ({
  hash: jest.fn(),
  compare: jest.fn(),
});

export const makeUserRepositoryMock = (): jest.Mocked<UserRepository> => ({
  create: jest.fn(),
  existsByEmail: jest.fn(),
});
