import {
  makeIdempotencyStrategyFactoryMock,
  makeIdempotencyStrategyMock,
} from '@app/testing/core/reliability/idempotency';
import {
  makeCallHandlerMock,
  makeContextMock,
  makeReflectorMock,
  makeRequestMock,
} from '@app/testing/system';
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
  const request = makeRequestMock();
  const runInterceptor = () => firstValueFrom(interceptor.intercept(context, callHandler));

  beforeEach(() => {
    interceptor = new IdempotencyInterceptor(reflector, factory);
    ({ callHandler, mockHandle } = makeCallHandlerMock());
    ({ context, mockGetRequest } = makeContextMock());
    mockHandle.mockReturnValue(of('ok'));
    mockGetRequest.mockReturnValue(request);
  });

  it('should call next.handle when no idempotency metadata is found', async () => {
    reflector.get.mockReturnValue(undefined);
    await expect(runInterceptor()).resolves.toBe('ok');
    expect(reflector.get).toHaveBeenCalledWith(IDEMPOTENCY_KEY, context.getHandler());
    expect(factory.get).not.toHaveBeenCalled();
    expect(mockHandle).toHaveBeenCalledTimes(1);
  });

  it('should delegate to the configured strategy when metadata exists', async () => {
    const options = { strategy: 'redis', ttl: 300 };
    const strategy = makeIdempotencyStrategyMock();
    strategy.handle.mockReturnValue(of('strategy result'));
    reflector.get.mockReturnValue(options);
    factory.get.mockReturnValue(strategy);
    await expect(runInterceptor()).resolves.toBe('strategy result');
    expect(factory.get).toHaveBeenCalledWith(options.strategy);
    expect(strategy.handle).toHaveBeenCalledWith(request, callHandler, options);
    expect(callHandler.handle).not.toHaveBeenCalled();
  });
});
