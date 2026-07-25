import type { OperationalDB } from '@app/database';
import type { Duration, Instant } from '@app/shared-kernel';
import type { ActionTokenPurpose } from '../../domain/aggregates/action-token.types';

export interface IssuedActionToken {
  readonly token: string;
  readonly expiresAt: Instant;
  readonly expiresIn: Duration;
}

export interface IssueActionTokenCommand {
  readonly purpose: ActionTokenPurpose;
  readonly userId: string;
}

export interface IssueActionToken {
  execute(db: OperationalDB, command: IssueActionTokenCommand): Promise<IssuedActionToken>;
}

export const ISSUE_ACTION_TOKEN = Symbol('ISSUE_ACTION_TOKEN');
