import { faker } from '@faker-js/faker';
import { context, metrics, propagation, SpanOptions, trace } from '@opentelemetry/api';

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
  const { meter, instruments } = makeMockMeter();

  const contextMock = {
    with: jest.fn().mockImplementation((_ctx, fn) => fn()),
    active: jest.fn().mockReturnValue({}),
  };
  const metricsMock = {
    getMeter: jest.fn().mockReturnValue(meter),
  };
  const propagationMock = {
    extract: jest.fn().mockImplementation((_ctx, carrier) => ({ __extracted: true, ...carrier })),
  };
  const traceMock = {
    getTracer: jest.fn().mockReturnValue(tracer),
    getSpan: jest.fn().mockReturnValue(span),
    getActiveSpan: jest.fn().mockReturnValue(span),
  };

  (metrics.getMeter as jest.Mock).mockImplementation(metricsMock.getMeter);
  (trace.getTracer as jest.Mock).mockImplementation(traceMock.getTracer);
  (trace.getSpan as jest.Mock).mockImplementation(traceMock.getSpan);
  (trace.getActiveSpan as jest.Mock).mockImplementation(traceMock.getActiveSpan);
  (context.with as jest.Mock).mockImplementation(contextMock.with);
  (context.active as jest.Mock).mockImplementation(contextMock.active);
  (propagation.extract as jest.Mock).mockImplementation(propagationMock.extract);

  return {
    span,
    tracer,
    meter,
    instruments,
    spies: {
      activeContext: contextMock.active,
      contextWith: contextMock.with,
      getMeter: metricsMock.getMeter,
      getSpan: traceMock.getSpan,
      getActiveSpan: traceMock.getActiveSpan,
      getTracer: traceMock.getTracer,
      propagationExtract: propagationMock.extract,
    },
  };
};
