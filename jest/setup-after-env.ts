import { Logger } from '@nestjs/common';

jest.mock('@opentelemetry/api', () => ({
  ...jest.requireActual('@opentelemetry/api'),
  trace: { getTracer: jest.fn(), getSpan: jest.fn(), setSpan: jest.fn() },
  context: { with: jest.fn(), active: jest.fn() },
  propagation: { extract: jest.fn(), inject: jest.fn() },
  metrics: { getMeter: jest.fn() },
  ROOT_CONTEXT: {},
}));
// Suppress expected error logs during tests to keep output clean
beforeEach(() => {
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});
