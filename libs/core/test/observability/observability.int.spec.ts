import { createOtelTestHarness, makeLoggerMock } from '@app/testing';
import { Controller, Get, INestApplication, Injectable, Module, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { getOptionalObservationContext } from '../../src/observability/context';
import { Metered, Observed } from '../../src/observability/decorators';
import { MetricsInterceptor, RequestLoggerInterceptor } from '../../src/observability/interceptors';
import { AppLoggerService } from '../../src/observability/logger';
import { MetricsService } from '../../src/observability/metrics';
import { ObservationContextMiddleware } from '../../src/observability/middlewares';
import { SpanStatusCode } from '@opentelemetry/api';

@Injectable()
class TestService {
  public capturedContext: any;

  constructor(
    readonly logger: AppLoggerService,
    readonly metrics: MetricsService,
  ) {}

  @Observed()
  @Metered()
  async run(): Promise<string> {
    this.capturedContext = getOptionalObservationContext();
    return 'ok';
  }

  @Observed()
  @Metered()
  async debug(): Promise<unknown> {
    return getOptionalObservationContext();
  }

  @Observed()
  @Metered()
  async fail(): Promise<never> {
    throw new Error('boom');
  }
}

@Controller()
class TestController {
  constructor(private readonly svc: TestService) {}

  @Get('/ok')
  async ok() {
    return this.svc.run();
  }

  @Get('/debug')
  async debug() {
    return this.svc.debug();
  }

  @Get('/fail')
  async fail() {
    return this.svc.fail();
  }
}

const { logger, contextLogger } = makeLoggerMock();
@Module({
  controllers: [TestController],
  providers: [
    TestService,
    MetricsService,
    { provide: AppLoggerService, useValue: logger },
    { provide: APP_INTERCEPTOR, useClass: RequestLoggerInterceptor },
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
  ],
})
class TestAppModule implements NestModule {
  configure(consumer: any) {
    consumer.apply(ObservationContextMiddleware).forRoutes('*');
  }
}

describe('Observability (Integration)', () => {
  let app: INestApplication;
  let service: TestService;

  const otel = createOtelTestHarness();

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    service = module.get(TestService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service.capturedContext = undefined;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should propagate correlation context through full request lifecycle', async () => {
    await request(app.getHttpServer())
      .get('/ok')
      .set('x-correlation-id', 'corr-123')
      .expect(200)
      .expect('ok');
    expect(service.capturedContext.correlationId).toBe('corr-123');
  });

  it('should generate correlation id when header is absent', async () => {
    const res = await request(app.getHttpServer()).get('/debug').expect(200);
    expect(res.body.correlationId).toEqual(expect.any(String));
  });

  it('should generate observability tracing signals', async () => {
    await request(app.getHttpServer()).get('/ok');
    expect(otel.tracer.startActiveSpan).toHaveBeenCalledWith(
      'TestService.run',
      expect.anything(),
      expect.any(Function),
    ); // via @Observed() decorator
    expect(otel.span.setStatus).toHaveBeenCalledWith(
      expect.objectContaining({ code: SpanStatusCode.OK }),
    ); // via @Observed() decorator
    expect(otel.span.end).toHaveBeenCalled(); // via @Observed() decorator
  });

  it('should generate observability metrics signals', async () => {
    await request(app.getHttpServer()).get('/ok');
    expect(otel.instruments.counter.add).toHaveBeenCalled(); // via @Metered() decorator
    expect(otel.instruments.histogram.record).toHaveBeenCalled(); // via @Metered() decorator
  });

  it('should generate observability logs signals', async () => {
    await request(app.getHttpServer()).get('/ok');
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('completed'),
      expect.objectContaining({ statusCode: 200 }),
    ); // via RequestLoggerInterceptor
    expect(contextLogger.log).toHaveBeenCalledWith(
      expect.stringContaining('completed'),
      expect.objectContaining({ durationMs: expect.any(Number) }),
    ); // via @Observed() decorator
  });

  it('should capture error flow across all layers', async () => {
    const res = await request(app.getHttpServer()).get('/fail');
    expect(res.status).toBe(500);
    expect(otel.span.recordException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'boom' }),
    ); // via @Observed() decorator
    expect(otel.span.setStatus).toHaveBeenCalledWith(
      expect.objectContaining({ code: SpanStatusCode.ERROR }),
    ); // with error status via @Observed() decorator
    expect(otel.instruments.counter.add).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ status: 'error' }),
    );
    expect(contextLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('failed'),
      expect.objectContaining({ errorMessage: 'boom' }),
    );
  });

  it('should keep ALS context isolated between requests', async () => {
    const contexts: any[] = [];
    const makeRequest = async (id: string) => {
      const res = await request(app.getHttpServer()).get('/debug').set('x-correlation-id', id);
      contexts.push(res.body);
    };
    await Promise.all([makeRequest('req-A'), makeRequest('req-B')]);
    expect(contexts).toHaveLength(2);
    expect(contexts.map((c) => c.correlationId).sort()).toEqual(['req-A', 'req-B']);
  });
});
