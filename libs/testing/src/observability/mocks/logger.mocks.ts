import { AppLoggerService, ContextLogger } from '@app/core/observability/logger';

export const makeLoggerMock = () => {
  const contextLogger = makeContextLoggerMock();
  const logger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    forContext: jest.fn().mockImplementation(() => contextLogger),
  } as unknown as jest.Mocked<AppLoggerService>;
  return { logger, contextLogger };
};

export const makeContextLoggerMock = () => {
  return {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  } as unknown as jest.Mocked<ContextLogger>;
};
