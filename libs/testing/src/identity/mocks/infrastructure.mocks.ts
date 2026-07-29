import type { Hashing } from '@app/contexts/identity/application/ports/hashing.port';
import type { UserRepository } from '@app/contexts/identity/domain/user/ports/repositories/user.repository';

export const makeArgon2HasherMock = (): jest.Mocked<Hashing> => ({
  hash: jest.fn(),
  compare: jest.fn(),
});

export const makeUserRepositoryMock = (): jest.Mocked<UserRepository> => ({
  create: jest.fn(),
  existsByEmail: jest.fn(),
});
