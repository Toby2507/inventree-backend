import { Logger } from '@nestjs/common';

// Suppress expected error logs during tests to keep output clean
beforeEach(() => {
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});
