import { AsyncLocalStorage } from 'async_hooks';
import { ObservationContext } from './observation-context';

export const observationStorage = new AsyncLocalStorage<ObservationContext>();

export function getObservationContext(): ObservationContext {
  const ctx = observationStorage.getStore();
  if (!ctx) throw new Error('ObservationContext not initialised. Is the middleware applied?');
  return ctx;
}

export function getOptionalObservationContext(): ObservationContext | undefined {
  return observationStorage.getStore();
}

export function getCorrelationId(): string {
  return observationStorage.getStore()?.correlationId ?? 'no-correlation-id';
}

export function setObservationContextActor(actor: ObservationContext['actor']): void {
  const ctx = observationStorage.getStore();
  if (!ctx) return;
  ctx.actor = actor;
}

export function setObservationContext(ctx: Partial<ObservationContext>): void {
  const current = observationStorage.getStore();
  if (!current) return;
  const updated: ObservationContext = {
    ...current,
    ...ctx,
  };
  observationStorage.enterWith(updated);
}
