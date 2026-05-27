import { faker } from '@faker-js/faker';
import { context, propagation, SpanOptions, trace } from '@opentelemetry/api';

export const makeMockSpan = () => ({
  setAttribute: jest.fn().mockReturnThis(),
  setAttributes: jest.fn().mockReturnThis(),
  setStatus: jest.fn().mockReturnThis(),
  recordException: jest.fn().mockReturnThis(),
  end: jest.fn(),
  spanContext: jest.fn().mockReturnValue({
    traceId: faker.string.hexadecimal({ length: 32, prefix: '' }),
    spanId: faker.string.hexadecimal({ length: 16, prefix: '' }),
    traceFlags: faker.number.int({ min: 0, max: 255 }),
  }),
  addEvent: jest.fn().mockReturnThis(),
});

export const makeMockTracer = (span = makeMockSpan()) => ({
  startSpan: jest.fn().mockReturnValue(span),
  startActiveSpan: jest
    .fn()
    .mockImplementation(
      (_name: string, _opts: SpanOptions, fn?: (span: ReturnType<typeof makeMockSpan>) => any) => {
        return fn ? fn(span) : span;
      },
    ),
});

export const makeMockMeter = () => {
  const counter = { add: jest.fn() };
  const histogram = { record: jest.fn() };
  const upDown = { add: jest.fn() };
  const gauge = { addCallback: jest.fn() };

  return {
    meter: {
      createCounter: jest.fn().mockReturnValue(counter),
      createHistogram: jest.fn().mockReturnValue(histogram),
      createUpDownCounter: jest.fn().mockReturnValue(upDown),
      createObservableGauge: jest.fn().mockReturnValue(gauge),
    },
    instruments: { counter, histogram, upDown, gauge },
  };
};

export const createOtelTestHarness = () => {
  const span = makeMockSpan();
  const tracer = makeMockTracer(span);

  const traceMock = {
    getTracer: jest.fn().mockReturnValue(tracer),
  };
  const contextMock = {
    with: jest.fn().mockImplementation((_ctx, fn) => fn()),
  };
  const propagationMock = {
    extract: jest.fn().mockImplementation((_ctx, carrier) => ({ __extracted: true, ...carrier })),
  };

  (trace.getTracer as jest.Mock).mockImplementation(traceMock.getTracer);
  (context.with as jest.Mock).mockImplementation(contextMock.with);
  (propagation.extract as jest.Mock).mockImplementation(propagationMock.extract);

  return {
    span,
    tracer,

    spies: {
      getTracer: traceMock.getTracer,
      contextWith: contextMock.with,
      propagationExtract: propagationMock.extract,
    },
  };
};
