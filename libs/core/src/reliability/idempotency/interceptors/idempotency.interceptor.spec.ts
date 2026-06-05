import { makeIdempotencyStrategyFactoryMock } from '@app/testing/core/reliability/idempotency';
import { makeCallHandlerMock, makeContextMock, makeReflectorMock } from '@app/testing/system';
import { firstValueFrom, of } from 'rxjs';
import { IDEMPOTENCY_KEY } from '../decorators/idempotency.decorator';
import { IdempotencyInterceptor } from './idempotency.interceptor';

describe('IdempotencyInterceptor', () => {
  let interceptor: IdempotencyInterceptor;
  let callHandler: ReturnType<typeof makeCallHandlerMock>['callHandler'];
  let mockHandle: jest.Mock;
  let context: ReturnType<typeof makeContextMock>['context'];
  let mockGetRequest: jest.Mock;

  const factory = makeIdempotencyStrategyFactoryMock();
  const reflector = makeReflectorMock();
  const runInterceptor = () => firstValueFrom(interceptor.intercept(context, callHandler));

  beforeEach(() => {
    interceptor = new IdempotencyInterceptor(reflector, factory);
    ({ callHandler, mockHandle } = makeCallHandlerMock());
    ({ context, mockGetRequest } = makeContextMock());
    const path = '/api/v1/auth/register';
    mockHandle.mockReturnValue(of('ok'));
    mockGetRequest.mockReturnValue({ method: 'POST', path, route: { path } });
  });

  it('should call next.handle directly if idempotency context is not provided', async () => {
    reflector.get.mockReturnValue(undefined);
    await runInterceptor();
    expect(reflector.get).toHaveBeenCalledWith(IDEMPOTENCY_KEY, undefined);
    expect(mockHandle).toHaveBeenCalledWith();
  });
});
