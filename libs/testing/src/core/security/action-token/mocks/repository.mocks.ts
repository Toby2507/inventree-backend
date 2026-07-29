import type { ActionTokenRepository } from '@app/core/security/action-token/domain/action-token.repository';

export const makeActionTokenRepositoryMock = () => {
  return {
    create: jest.fn(),
    update: jest.fn(),
    findByHash: jest.fn(),
    findUsableByUserAndPurpose: jest.fn(),
    findUsableByUser: jest.fn(),
    findById: jest.fn(),
    revokeUsableByIds: jest.fn(),
    deleteExpired: jest.fn(),
  } as unknown as jest.Mocked<ActionTokenRepository>;
};
