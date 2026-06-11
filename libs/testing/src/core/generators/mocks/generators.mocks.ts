import { IDGeneratorPort } from '@app/core/generators';

export const makeIDGeneratorMock = (): jest.Mocked<IDGeneratorPort> => ({
  generateUUIDV4: jest.fn(),
  generateUUIDV7: jest.fn(),
});
