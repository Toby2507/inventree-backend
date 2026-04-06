import { makeCallHandler, makeContext } from '@app/testing';
import { Expose } from 'class-transformer';
import { firstValueFrom, of } from 'rxjs';
import { SerializerInterceptor } from './serializer.interceptor';

class UserDto {
  @Expose()
  id!: string;

  @Expose()
  email!: string;

  // intentionally not @Expose() — must be stripped
  password!: string;
}

const mockContext = makeContext().context;

describe('SerializerInterceptor', () => {
  let interceptor: SerializerInterceptor;

  beforeEach(() => {
    interceptor = new SerializerInterceptor(UserDto);
  });

  describe('when response has no data envelope (data property absent)', () => {
    const { callHandler, mockHandle } = makeCallHandler();

    it('passes null through unchanged', async () => {
      mockHandle.mockReturnValueOnce(of(null));
      const result = await firstValueFrom(interceptor.intercept(mockContext, callHandler));
      expect(result).toBeNull();
    });

    it('passes a plain string through unchanged', async () => {
      mockHandle.mockReturnValueOnce(of('plain string'));
      const result = await firstValueFrom(interceptor.intercept(mockContext, callHandler));
      expect(result).toBe('plain string');
    });

    it('passes the response through unchanged', async () => {
      const raw = { message: 'ok' };
      mockHandle.mockReturnValueOnce(of(raw));
      const result = await firstValueFrom(interceptor.intercept(mockContext, callHandler));
      expect(result).toEqual({ message: 'ok' });
    });
  });

  describe('when response contains a single object in data', () => {
    const raw = {
      data: { id: 'u-1', email: 'a@b.com', password: 'secret' },
    };
    const { callHandler, mockHandle } = makeCallHandler();
    mockHandle.mockReturnValue(of(raw));

    it('returns a UserDto instance', async () => {
      const result = await firstValueFrom<any>(interceptor.intercept(mockContext, callHandler));
      expect(result.data).toBeInstanceOf(UserDto);
    });

    it('includes @Expose() properties', async () => {
      const result = await firstValueFrom<any>(interceptor.intercept(mockContext, callHandler));
      expect(result.data.id).toBe('u-1');
      expect(result.data.email).toBe('a@b.com');
    });

    it('strips properties not decorated with @Expose()', async () => {
      const result = await firstValueFrom<any>(interceptor.intercept(mockContext, callHandler));
      expect(result.data).not.toHaveProperty('password');
    });

    it('preserves other envelope fields alongside data', async () => {
      const withMeta = { ...raw, meta: { total: 1 } };
      mockHandle.mockReturnValueOnce(of(withMeta));
      const result = await firstValueFrom<any>(interceptor.intercept(mockContext, callHandler));
      expect(result.meta).toEqual({ total: 1 });
    });
  });

  describe('when response contains an array in data', () => {
    const raw = {
      data: [
        { id: 'u-1', email: 'a@b.com', password: 'secret1' },
        { id: 'u-2', email: 'b@c.com', password: 'secret2' },
      ],
    };
    const { callHandler, mockHandle } = makeCallHandler();
    mockHandle.mockReturnValue(of(raw));

    it('returns an array of UserDto instances', async () => {
      const result = await firstValueFrom<any>(interceptor.intercept(mockContext, callHandler));
      expect(Array.isArray(result.data)).toBe(true);
      result.data.forEach((item: unknown) => expect(item).toBeInstanceOf(UserDto));
    });

    it('includes @Expose() properties on each item', async () => {
      const result = await firstValueFrom<any>(interceptor.intercept(mockContext, callHandler));
      expect(result.data[0].id).toBe('u-1');
      expect(result.data[1].email).toBe('b@c.com');
    });

    it('strips non-@Expose() properties from every item', async () => {
      const result = await firstValueFrom<any>(interceptor.intercept(mockContext, callHandler));
      result.data.forEach((item: unknown) => expect(item).not.toHaveProperty('password'));
    });

    it('returns the same number of items as the input array', async () => {
      const result = await firstValueFrom<any>(interceptor.intercept(mockContext, callHandler));
      expect(result.data).toHaveLength(2);
    });

    it('handles an empty array without error', async () => {
      mockHandle.mockReturnValueOnce(of({ data: [] }));
      const result = await firstValueFrom<any>(interceptor.intercept(mockContext, callHandler));
      expect(result.data).toEqual([]);
    });

    it('preserves other envelope fields alongside data', async () => {
      const withMeta = { ...raw, meta: { hasNextPage: false, nextCursor: null } };
      mockHandle.mockReturnValueOnce(of(withMeta));
      const result = await firstValueFrom<any>(interceptor.intercept(mockContext, callHandler));
      expect(result.meta).toEqual({ hasNextPage: false, nextCursor: null });
    });
  });
});
