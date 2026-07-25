import type { ContextLogger, Logger } from '@app/core/observability/ports/logger.port';

export const makeMockPino = () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
  child: jest.fn().mockReturnThis(),
});

export const makeLoggerMock = () => {
  const contextLogger = makeContextLoggerMock();
  const logger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    forContext: jest.fn().mockImplementation(() => contextLogger),
  } as unknown as jest.Mocked<Logger>;
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
