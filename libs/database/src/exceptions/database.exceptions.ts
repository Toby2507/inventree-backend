import { InfrastructureException } from '@app/shared-kernel';

export class OptimisticConcurrencyControlException extends InfrastructureException {
  readonly code = 'OPTIMISTIC_CONCURRENCY_CONTROL';

  constructor(
    readonly resource: string,
    readonly id: string,
    cause?: unknown,
  ) {
    super(`Failed to update ${resource} due to optimistic concurrency control.`, {
      resource,
      id,
      cause,
    });
  }
}
