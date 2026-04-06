import { ArgumentsHost, CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

interface HostMocks {
  host: ArgumentsHost;
  mockStatus: jest.Mock;
  mockJson: jest.Mock;
}
interface ContextMocks {
  context: ExecutionContext;
  mockGetHandler: jest.Mock;
  mockGetClass: jest.Mock;
}
interface CallHandlerMocks {
  callHandler: CallHandler;
  mockHandle: jest.Mock;
}

export const makeHost = (): HostMocks => {
  const mockJson = jest.fn();
  const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
  const mockGetResponse = jest.fn().mockReturnValue({ status: mockStatus });
  const mockSwitchToHttp = jest.fn().mockReturnValue({ getResponse: mockGetResponse });
  const host = { switchToHttp: mockSwitchToHttp } as unknown as ArgumentsHost;
  return { host, mockStatus, mockJson };
};

export const makeContext = (): ContextMocks => {
  const mockGetHandler = jest.fn();
  const mockGetClass = jest.fn();
  return {
    context: {
      getHandler: mockGetHandler,
      getClass: mockGetClass,
    } as unknown as ExecutionContext,
    mockGetHandler,
    mockGetClass,
  };
};

export const makeReflector = () => {
  return {
    getAllAndOverride: jest.fn(),
  } as unknown as jest.Mocked<Reflector>;
};

export const makeCallHandler = (): CallHandlerMocks => {
  const mockHandle = jest.fn();
  return {
    callHandler: {
      handle: mockHandle,
    },
    mockHandle,
  };
};
