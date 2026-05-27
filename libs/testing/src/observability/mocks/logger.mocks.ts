import { AppLoggerService, ContextLogger } from '@app/core/observability/logger';

export const makeLoggerMock = () => {
  return {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    forContext: jest.fn().mockImplementation(() => makeContextLoggerMock()),
  } as unknown as jest.Mocked<AppLoggerService>;
};

export const makeContextLoggerMock = () => {
  return {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  } as unknown as jest.Mocked<ContextLogger>;
};
