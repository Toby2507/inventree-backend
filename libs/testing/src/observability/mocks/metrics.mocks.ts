import { MetricsPort } from '@app/core/observability';

export const makeMetricsMock = () => {
  return {
    record: jest.fn(),
    increment: jest.fn(),
    adjust: jest.fn(),
    gauge: jest.fn(),
    timeAsync: jest
      .fn()
      .mockImplementation((_d: string, _t: string, _a: object, fn: () => Promise<unknown>) => fn()),
  } as unknown as jest.Mocked<MetricsPort>;
};
