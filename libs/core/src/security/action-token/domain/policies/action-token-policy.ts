import type { Duration } from '@app/shared-kernel';
import type { ActionTokenPurpose } from '../aggregates/action-token.types';

export interface ActionTokenPolicy {
  readonly purpose: ActionTokenPurpose;
  readonly ttl: Duration;
  readonly singleActiveInstance: boolean;
}
