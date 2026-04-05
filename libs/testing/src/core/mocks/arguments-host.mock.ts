import { ArgumentsHost } from '@nestjs/common';

interface HostMocks {
  host: ArgumentsHost;
  mockStatus: jest.Mock;
  mockJson: jest.Mock;
}

export const makeHost = (): HostMocks => {
  const mockJson = jest.fn();
  const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
  const mockGetResponse = jest.fn().mockReturnValue({ status: mockStatus });
  const mockSwitchToHttp = jest.fn().mockReturnValue({ getResponse: mockGetResponse });
  const host = { switchToHttp: mockSwitchToHttp } as unknown as ArgumentsHost;
  return { host, mockStatus, mockJson };
};
