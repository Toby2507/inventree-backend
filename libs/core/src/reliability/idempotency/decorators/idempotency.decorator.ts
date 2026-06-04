import { IDEMPOTENCY_HEADER } from '@app/common';
import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';

export type IdempotencyStrategyType = 'redis' | 'durable';

export interface IdempotencyOptions {
  strategy: IdempotencyStrategyType;
  scope: string;
  ttlSeconds?: number; // optional override
}

export const IDEMPOTENCY_KEY = Symbol('idempotency');
export const Idempotent = (options: IdempotencyOptions) =>
  applyDecorators(
    SetMetadata(IDEMPOTENCY_KEY, options),
    ApiHeader({
      name: IDEMPOTENCY_HEADER,
      description: 'Unique key to ensure idempotent requests',
      required: true,
    }),
  );
