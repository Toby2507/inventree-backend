import { makeCallHandlerMock, makeContextMock, makeMetricsMock } from '@app/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { MetricNames } from '../metrics';
import { MetricsInterceptor } from './metrics.interceptor';

describe('MetricsInterceptor', () => {
  let interceptor: MetricsInterceptor;
  let callHandler: ReturnType<typeof makeCallHandlerMock>['callHandler'];
  let mockHandle: jest.Mock;
  let context: ReturnType<typeof makeContextMock>['context'];
  let mockGetRequest: jest.Mock;
  let mockGetResponse: jest.Mock;

  const metrics = makeMetricsMock();
  const runInterceptor = () => firstValueFrom(interceptor.intercept(context, callHandler));

  beforeEach(() => {
    interceptor = new MetricsInterceptor(metrics);
    ({ callHandler, mockHandle } = makeCallHandlerMock());
    ({ context, mockGetRequest, mockGetResponse } = makeContextMock());
    const path = '/api/v1/auth/register';
    mockHandle.mockReturnValue(of('ok'));
    mockGetRequest.mockReturnValue({ method: 'POST', path, route: { path } });
    mockGetResponse.mockReturnValue({ statusCode: 201 });
  });

  it('handles missing route metadata gracefully', async () => {
    mockGetRequest.mockReturnValue({
      method: 'POST',
      path: '/raw/path',
      route: undefined,
    });
    await runInterceptor();
    expect(metrics.increment).toHaveBeenCalledWith(
      MetricNames.HTTP_TOTAL,
      expect.objectContaining({
        route: '/raw/path',
      }),
    );
  });

  it('should increment active request counter on entry', async () => {
    await runInterceptor();
    expect(metrics.adjust).toHaveBeenNthCalledWith(
      1,
      MetricNames.HTTP_ACTIVE,
      1,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('records all terminal metrics on success', async () => {
    await runInterceptor();
    expect(metrics.record).toHaveBeenCalledWith(
      MetricNames.HTTP_DURATION,
      expect.any(Number),
      expect.objectContaining({ status_code: '201', method: 'POST' }),
    );
    expect(metrics.increment).toHaveBeenCalledWith(
      MetricNames.HTTP_TOTAL,
      expect.objectContaining({ status_code: '201', route: '/api/v1/auth/register' }),
    );
    expect(metrics.adjust).toHaveBeenNthCalledWith(
      2,
      MetricNames.HTTP_ACTIVE,
      -1,
      expect.anything(),
    );
  });

  it('records all terminal metrics on failure', async () => {
    const error = Object.assign(new Error('boom'), { status: 500 });
    mockHandle.mockReturnValueOnce(throwError(() => error));
    await expect(() => runInterceptor()).rejects.toThrow();
    expect(metrics.record).toHaveBeenCalledWith(
      MetricNames.HTTP_DURATION,
      expect.any(Number),
      expect.objectContaining({ status_code: '500', method: 'POST' }),
    );
    expect(metrics.increment).toHaveBeenCalledWith(
      MetricNames.HTTP_TOTAL,
      expect.objectContaining({ status_code: '500', route: '/api/v1/auth/register' }),
    );
    expect(metrics.adjust).toHaveBeenNthCalledWith(
      2,
      MetricNames.HTTP_ACTIVE,
      -1,
      expect.anything(),
    );
  });
});
