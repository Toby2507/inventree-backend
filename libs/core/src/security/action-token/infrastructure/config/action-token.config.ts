import { Duration } from '@app/shared-kernel';

export interface ActionTokenConfig {
  readonly cleanupBatchSize: number;
  readonly retentionPeriod: Duration;
}

export const DEFAULT_ACTION_TOKEN_CONFIG: ActionTokenConfig = {
  cleanupBatchSize: 1000,
  retentionPeriod: Duration.days(7),
};

export const TOKEN_CONFIG = Symbol('ACTION_TOKEN_CONFIG');
