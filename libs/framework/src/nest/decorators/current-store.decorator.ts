import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { getStoreContext, StoreContext } from '@app/database';

/**
 * Controller parameter decorator that injects the current StoreContext.
 *
 * Reads from AsyncLocalStorage — requires StoreContextInterceptor to be
 * applied globally. Will throw if called on an unprotected route where
 * StoreContextInterceptor did not set a context.
 *
 * Usage:
 *   @Get('me')
 *   getMe(@CurrentStore() store: StoreContext) { ... }
 */
export const CurrentStore = createParamDecorator(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (_data: unknown, _ctx: ExecutionContext): StoreContext => {
    return getStoreContext();
  },
);
