import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { storeContextStorage, StoreContext } from '@app/database';

/**
 * The minimum shape StoreContextInterceptor requires from req.user.
 * JwtStrategy in the identity context must produce a payload that satisfies
 * this interface. The interceptor deliberately avoids importing JwtPayload
 * from identity to keep libs/common free of bounded context dependencies.
 */
interface StoreAwareUser {
  sub: string;
  storeId: string;
  businessId: string;
  storeMemberId: string;
  role: string;
}

function isStoreAwareUser(user: unknown): user is StoreAwareUser {
  if (typeof user !== 'object' || user === null) return false;
  const u = user as Record<string, unknown>;
  return (
    typeof u['sub'] === 'string' &&
    typeof u['storeId'] === 'string' &&
    typeof u['businessId'] === 'string' &&
    typeof u['storeMemberId'] === 'string' &&
    typeof u['role'] === 'string'
  );
}

/**
 * Populates AsyncLocalStorage with StoreContext for the duration of a request.
 *
 * Reads req.user — set by JwtStrategy.validate() after Passport verifies the
 * token. By the time this interceptor runs, the payload is already verified;
 * no decoding or validation is needed here.
 *
 * Why an interceptor and not the guard itself:
 *   Guards run before the handler but do not wrap its execution. A guard
 *   calling storeContextStorage.run() would set context in a callback that
 *   completes before the handler is invoked — the handler would run outside
 *   that context. Interceptors receive next.handle() as an Observable, which
 *   means the entire handler execution (including async continuations) can be
 *   wrapped inside storeContextStorage.run().
 *
 * Why new Observable() and not switchMap / tap:
 *   RxJS operators create new async microtask boundaries. AsyncLocalStorage
 *   propagates through async/await continuations but not across arbitrary
 *   RxJS operator chains. Wrapping subscribe() directly inside
 *   storeContextStorage.run() ensures the handler's synchronous setup AND
 *   all its awaited continuations inherit the correct context.
 *
 * Public routes (where JwtAuthGuard was skipped and req.user is undefined)
 * are passed through without setting any context.
 *
 * Register globally in AppModule:
 *   { provide: APP_INTERCEPTOR, useClass: StoreContextInterceptor }
 */
@Injectable()
export class StoreContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    if (!isStoreAwareUser(user)) return next.handle();

    const storeContext: StoreContext = {
      userId: user.sub,
      storeId: user.storeId,
      businessId: user.businessId,
      storeMemberId: user.storeMemberId,
      role: user.role,
    };

    return new Observable((subscriber) => {
      storeContextStorage.run(storeContext, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
