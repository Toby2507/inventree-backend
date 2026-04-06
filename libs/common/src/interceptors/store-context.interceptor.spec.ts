import { storeContextStorage } from '@app/database';
import { jwtPayloadFaker, makeCallHandler, makeContext } from '@app/testing';
import { Observable, firstValueFrom, of } from 'rxjs';
import { StoreContextInterceptor } from './store-context.interceptor';

const validPayload = jwtPayloadFaker.generate();

describe('StoreContextInterceptor', () => {
  let interceptor: StoreContextInterceptor;

  beforeEach(() => {
    interceptor = new StoreContextInterceptor();
  });

  describe.each([
    { label: 'undefined (public route)', user: undefined },
    { label: 'invalid (fails validation)', user: { foo: 'bar' } },
  ])('when req.user is $label', ({ user }) => {
    const { callHandler, mockHandle } = makeCallHandler();
    const { context, mockGetRequest } = makeContext();
    mockGetRequest.mockReturnValue({ user });
    mockHandle.mockReturnValue(of('ok'));

    it('passes through without setting store context', async () => {
      const result$ = interceptor.intercept(context, callHandler);
      await firstValueFrom(result$);
      expect(storeContextStorage.getStore()).toBeUndefined();
    });

    it('returns the handler observable unchanged', async () => {
      mockHandle.mockReturnValueOnce(of('passthrough'));
      const result$ = interceptor.intercept(context, callHandler);
      expect(await firstValueFrom(result$)).toBe('passthrough');
    });
  });

  describe('when req.user is a valid JwtPayload', () => {
    const { callHandler, mockHandle } = makeCallHandler();
    const { context, mockGetRequest } = makeContext();
    mockGetRequest.mockReturnValue({ user: validPayload });
    it('makes StoreContext available inside the handler via AsyncLocalStorage', async () => {
      let capturedContext: ReturnType<typeof storeContextStorage.getStore>;
      mockHandle.mockImplementationOnce(
        () =>
          new Observable((sub) => {
            capturedContext = storeContextStorage.getStore();
            sub.next('ok');
            sub.complete();
          }),
      );
      await firstValueFrom(interceptor.intercept(context, callHandler));
      expect(capturedContext).toEqual({
        userId: validPayload.sub,
        storeId: validPayload.storeId,
        businessId: validPayload.businessId,
        storeMemberId: validPayload.storeMemberId,
        role: validPayload.role,
      });
    });

    it('maps sub → userId correctly', async () => {
      let userId: string | undefined;
      mockHandle.mockImplementationOnce(
        () =>
          new Observable((sub) => {
            userId = storeContextStorage.getStore()?.userId;
            sub.next('ok');
            sub.complete();
          }),
      );
      await firstValueFrom(interceptor.intercept(context, callHandler));
      expect(userId).toBe(validPayload.sub);
    });

    it('does not leak context outside the request observable', async () => {
      mockHandle.mockReturnValueOnce(of('ok'));
      await firstValueFrom(interceptor.intercept(context, callHandler));
      expect(storeContextStorage.getStore()).toBeUndefined();
    });

    it('forwards the handler response to the subscriber', async () => {
      mockHandle.mockReturnValueOnce(of({ data: 'payload' }));
      const result$ = interceptor.intercept(context, callHandler);
      expect(await firstValueFrom(result$)).toEqual({ data: 'payload' });
    });
  });
});
