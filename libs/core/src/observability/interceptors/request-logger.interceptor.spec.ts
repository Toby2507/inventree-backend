import {
  fsObservationContext,
  makeCallHandlerMock,
  makeContextMock,
  makeLoggerMock,
} from '@app/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { observationStorage } from '../context/observation-context.storage';
import { AppLoggerService } from '../logger/app-logger.service';
import { RequestLoggerInterceptor } from './request-logger.interceptor';

const ctx = fsObservationContext.generate();

describe('RequestLoggerInterceptor', () => {
  let interceptor: RequestLoggerInterceptor;
  let logger: AppLoggerService;
  let callHandler: ReturnType<typeof makeCallHandlerMock>['callHandler'];
  let mockHandle: jest.Mock;
  let context: ReturnType<typeof makeContextMock>['context'];
  let mockGetRequest: jest.Mock;
  let mockGetResponse: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = makeLoggerMock();
    interceptor = new RequestLoggerInterceptor(logger);
    ({ callHandler, mockHandle } = makeCallHandlerMock());
    ({ context, mockGetRequest, mockGetResponse } = makeContextMock());
    mockHandle.mockReturnValue(of('ok'));
    mockGetRequest.mockReturnValue({ method: 'POST', path: '/api/v1/auth/register' });
    mockGetResponse.mockReturnValue({ statusCode: 201 });
  });

  it('logs incoming request with method, path, and correlationId', async () => {
    await observationStorage.run(ctx, () =>
      firstValueFrom(interceptor.intercept(context, callHandler)),
    );
    expect(logger.log).toHaveBeenCalledWith(
      'Incoming request',
      expect.objectContaining({
        method: 'POST',
        path: '/api/v1/auth/register',
        idempotencyKey: ctx.idempotencyKey,
      }),
    );
  });

  it('logs request completion with statusCode and durationMs', async () => {
    await observationStorage.run(ctx, () =>
      firstValueFrom(interceptor.intercept(context, callHandler)),
    );
    expect(logger.log).toHaveBeenCalledWith(
      'Request completed',
      expect.objectContaining({
        statusCode: 201,
        durationMs: expect.any(Number),
      }),
    );
  });

  it('logs error with errorMessage on handler failure', async () => {
    const error = new Error('Unhandled explosion');
    (error as any).code = 'INTERNAL_ERROR';
    mockHandle.mockReturnValueOnce(throwError(() => error));
    await expect(
      observationStorage.run(ctx, () =>
        firstValueFrom(interceptor.intercept(context, callHandler)),
      ),
    ).rejects.toThrow();
    expect(logger.error).toHaveBeenCalledWith(
      'Request failed',
      expect.objectContaining({
        errorMessage: 'Unhandled explosion',
        errorCode: 'INTERNAL_ERROR',
      }),
    );
  });

  it('works without an ObservationContext (e.g. health check route)', async () => {
    await firstValueFrom(interceptor.intercept(context, callHandler));
    expect(logger.log).toHaveBeenCalledWith(
      'Incoming request',
      expect.objectContaining({ idempotencyKey: undefined }),
    );
  });
});
