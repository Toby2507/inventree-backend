import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { IDEMPOTENCY_KEY, IdempotencyOptions } from '../decorators/idempotency.decorator';
import { IdempotencyStrategyFactory } from '../strategies/factory';

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
