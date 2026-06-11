import { ConfigService } from '@nestjs/config';

export const makeConfigMock = () => {
  return {
    get: jest.fn(),
  } as unknown as jest.Mocked<ConfigService>;
};
