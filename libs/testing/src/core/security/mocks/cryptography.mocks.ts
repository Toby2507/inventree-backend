import { CryptographyPort } from '@app/core/security/cryptography';

export const makeCryptographyMock = () => {
  return {
    sha256: jest.fn(),
    encrypt: jest.fn(),
    decrypt: jest.fn(),
    randomBytes: jest.fn(),
    randomToken: jest.fn(),
  } as unknown as jest.Mocked<CryptographyPort>;
};
