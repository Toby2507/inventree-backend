import { HashingPort } from '@app/contexts/identity/application/ports/hashing.port';
import { UserRepository } from '@app/contexts/identity/domain/user/ports/repositories/user.repository';

export const makeArgon2HasherMock = (): jest.Mocked<HashingPort> => ({
  hash: jest.fn(),
  compare: jest.fn(),
});

export const makeUserRepositoryMock = (): jest.Mocked<UserRepository> => ({
  create: jest.fn(),
  existsByEmail: jest.fn(),
});
