import { ObfuscationPort } from '@app/core/security';

export const makeObfuscationMock = () => {
  return {
    hash: jest.fn(),
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  } as unknown as jest.Mocked<ObfuscationPort>;
};
