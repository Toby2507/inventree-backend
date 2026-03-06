import { AsyncLocalStorage } from 'async_hooks';

export interface StoreContext {
  storeId: string;
  businessId: string;
  userId: string;
  storeMemberId: string;
  role: string;
}

export const storeContextStorage = new AsyncLocalStorage<StoreContext>();

export function getStoreContext(): StoreContext {
  const context = storeContextStorage.getStore();
  if (!context)
    throw new Error('No store context found. Ensure StoreContextMiddleware is applied.');
  return context;
}

export function getOptionalStoreContext(): StoreContext | undefined {
  return storeContextStorage.getStore();
}
