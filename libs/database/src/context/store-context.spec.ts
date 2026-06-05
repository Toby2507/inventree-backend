import { fsStoreContext } from '@app/testing/identity';
import { getOptionalStoreContext, getStoreContext, storeContextStorage } from './store-context';

const mockContext = fsStoreContext.generate();

describe('StoreContext', () => {
  describe('getStoreContext', () => {
    it('throws when no context is set', () => {
      expect(() => getStoreContext()).toThrow(
        'No store context found. Ensure StoreContextMiddleware is applied.',
      );
    });

    it('returns the context when set', (done) => {
      storeContextStorage.run(mockContext, () => {
        expect(getStoreContext()).toEqual(mockContext);
        done();
      });
    });

    it('does not leak context across async boundaries', (done) => {
      storeContextStorage.run(mockContext, () => {
        expect(getStoreContext()).toEqual(mockContext);
      });
      expect(() => getStoreContext()).toThrow();
      done();
    });

    it('isolates nested contexts correctly', (done) => {
      const outer = fsStoreContext.generate({ storeId: 'outer' });
      const inner = fsStoreContext.generate({ storeId: 'inner' });
      storeContextStorage.run(outer, () => {
        expect(getStoreContext().storeId).toBe('outer');
        storeContextStorage.run(inner, () => {
          expect(getStoreContext().storeId).toBe('inner');
        });
        expect(getStoreContext().storeId).toBe('outer');
        done();
      });
    });

    it('propagates through async continuations', async () => {
      let capturedStoreId: string | undefined;
      await new Promise<void>((resolve) => {
        storeContextStorage.run(mockContext, async () => {
          await Promise.resolve();
          capturedStoreId = getStoreContext().storeId;
          resolve();
        });
      });
      expect(capturedStoreId).toBe(mockContext.storeId);
    });
  });

  describe('getOptionalStoreContext', () => {
    it('returns undefined when no context is set', () => {
      expect(getOptionalStoreContext()).toBeUndefined();
    });

    it('returns the context when set', (done) => {
      storeContextStorage.run(mockContext, () => {
        expect(getOptionalStoreContext()).toEqual(mockContext);
        done();
      });
    });
  });
});
