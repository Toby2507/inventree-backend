import { UUIDGeneratorPort } from '@app/core';

export const makeUUIDGeneratorMock = (): jest.Mocked<UUIDGeneratorPort> => ({
  generateV4: jest.fn(),
  generateV7: jest.fn(),
});
