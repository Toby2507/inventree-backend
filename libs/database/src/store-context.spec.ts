import {
  getStoreContext,
  getOptionalStoreContext,
  storeContextStorage,
  StoreContext,
} from './store-context';

const mockContext: StoreContext = {
  storeId: 'store-abc',
  businessId: 'biz-abc',
  userId: 'user-abc',
  storeMemberId: 'member-abc',
  role: 'owner',
};

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
        // inner context visible here
        expect(getStoreContext()).toEqual(mockContext);
      });

      // outer scope — context should be gone
      expect(() => getStoreContext()).toThrow();
      done();
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
