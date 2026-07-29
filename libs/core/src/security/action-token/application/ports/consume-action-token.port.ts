import type { OperationalDB } from '@app/database';
import type { ActionToken } from '../../domain/aggregates/action-token.aggregate';
import type { ActionTokenPurpose } from '../../domain/aggregates/action-token.types';

export interface ConsumeActionTokenCommand {
  readonly purpose: ActionTokenPurpose;
  readonly token: string;
}

export interface ConsumeActionToken {
  execute(db: OperationalDB, command: ConsumeActionTokenCommand): Promise<ActionToken>;
}

export const CONSUME_TOKEN = Symbol('CONSUME_ACTION_TOKEN');
