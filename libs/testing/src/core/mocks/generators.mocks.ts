import { UUIDGeneratorPort } from '@app/core/generators';

export const makeUUIDGeneratorMock = (): jest.Mocked<UUIDGeneratorPort> => ({
  generateV4: jest.fn(),
  generateV7: jest.fn(),
});
