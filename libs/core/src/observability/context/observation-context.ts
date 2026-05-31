import { context as otelCtx, propagation } from '@opentelemetry/api';

export interface ObservationContext {
  readonly correlationId: string;
  readonly causationId?: string;
  readonly idempotencyKey?: string;
  actor?: {
    userId: string;
    storeId: string;
    role: string;
  };
}

export interface SerializedBusinessContext {
  correlationId: string;
  causationId?: string;
  idempotencyKey?: string;
  actorUserId?: string;
  actorStoreId?: string;
  actorRole?: string;
}

export interface SerializedOutboxContext extends SerializedBusinessContext {
  traceparent?: string;
  tracestate?: string;
}

export function serializeBusinessContext(ctx: ObservationContext): SerializedBusinessContext {
  return {
    correlationId: ctx.correlationId,
    causationId: ctx.causationId,
    idempotencyKey: ctx.idempotencyKey,
    actorUserId: ctx.actor?.userId,
    actorStoreId: ctx.actor?.storeId,
    actorRole: ctx.actor?.role,
  };
}

export function serializeOutboxContext(ctx: ObservationContext): SerializedOutboxContext {
  const carrier: Record<string, string> = {};
  propagation.inject(otelCtx.active(), carrier);

  return {
    correlationId: ctx.correlationId,
    causationId: ctx.causationId,
    idempotencyKey: ctx.idempotencyKey,
    actorUserId: ctx.actor?.userId,
    actorStoreId: ctx.actor?.storeId,
    actorRole: ctx.actor?.role,
    traceparent: carrier.traceparent,
    tracestate: carrier.tracestate,
  };
}
