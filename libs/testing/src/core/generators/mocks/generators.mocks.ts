import { IDGenerator } from '@app/core/generators';

export const makeIdGeneratorMock = (): jest.Mocked<IDGenerator> => ({
  generateUUIDV4: jest.fn(),
  generateUUIDV7: jest.fn(),
});
