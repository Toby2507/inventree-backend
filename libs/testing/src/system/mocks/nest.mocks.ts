import { Fn } from '@app/common';
import { ArgumentsHost, CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';

interface HostMocks {
  host: ArgumentsHost;
  mockStatus: jest.Mock;
  mockJson: jest.Mock;
  mockGetRequest: jest.Mock;
}
interface ContextMocks {
  context: ExecutionContext;
  mockGetHandler: jest.Mock;
  mockGetClass: jest.Mock;
  mockGetRequest: jest.Mock;
}
interface CallHandlerMocks {
  callHandler: CallHandler;
  mockHandle: jest.Mock;
}
interface MockRequestArgs {
  method?: string;
  path?: string;
  headers?: Record<string, string>;
}

export const makeHostMock = (): HostMocks => {
  const mockJson = jest.fn();
  const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
  const mockGetResponse = jest.fn().mockReturnValue({ status: mockStatus });
  const mockGetRequest = jest.fn();
  const mockSwitchToHttp = jest
    .fn()
    .mockReturnValue({ getResponse: mockGetResponse, getRequest: mockGetRequest });
  const host = { switchToHttp: mockSwitchToHttp } as unknown as ArgumentsHost;
  return { host, mockStatus, mockJson, mockGetRequest };
};

export const makeContextMock = (): ContextMocks => {
  const mockGetHandler = jest.fn();
  const mockGetClass = jest.fn();
  const { host, mockGetRequest } = makeHostMock();
  return {
    context: {
      getHandler: mockGetHandler,
      getClass: mockGetClass,
      ...host,
    } as unknown as ExecutionContext,
    mockGetHandler,
    mockGetClass,
    mockGetRequest,
  };
};

export const makeReflectorMock = () => {
  return {
    getAllAndOverride: jest.fn(),
  } as unknown as jest.Mocked<Reflector>;
};

export const makeCallHandlerMock = (): CallHandlerMocks => {
  const mockHandle = jest.fn();
  return {
    callHandler: {
      handle: mockHandle,
    },
    mockHandle,
  };
};

const DEFAULT_REQ_ARGS: MockRequestArgs = {
  method: 'GET',
  path: '/api/v1/test',
  headers: {},
};
export const makeRequestMock = ({ method, path, headers }: MockRequestArgs = DEFAULT_REQ_ARGS) => {
  return {
    method,
    path,
    headers,
    route: { path },
  } as unknown as jest.Mocked<Request>;
};

export const makeResponseMock = () => {
  const listeners: Record<string, Fn> = {};
  return {
    setHeader: jest.fn(),
    statusCode: 200,
    on: jest.fn((event: string, cb: Fn) => {
      listeners[event] = cb;
    }),
    emit: (event: string) => listeners[event]?.(),
  } as unknown as jest.Mocked<Response>;
};
