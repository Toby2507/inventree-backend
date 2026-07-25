import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import { IDEMPOTENCY_KEY, type IdempotencyOptions } from '../decorators/idempotency.decorator';
import type { IdempotencyStrategyFactory } from '../strategies/factory';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly factory: IdempotencyStrategyFactory,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const options = this.reflector.get<IdempotencyOptions>(IDEMPOTENCY_KEY, context.getHandler());
    if (!options) return next.handle();

    const request = context.switchToHttp().getRequest<Request>();
    const strategy = this.factory.get(options.strategy);

    return strategy.handle(request, next, options);
  }
}
