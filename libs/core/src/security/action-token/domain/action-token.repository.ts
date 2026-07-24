import { OperationalDB } from '@app/database';
import { Instant } from '@app/shared-kernel';
import { ActionToken } from './action-token.aggregate';

export interface ActionTokenRepository {
  create(db: OperationalDB, token: ActionToken): Promise<void>;
  update(db: OperationalDB, token: ActionToken): Promise<void>;
  findByHash(db: OperationalDB, hash: string): Promise<ActionToken | null>;
  findActiveByUserAndPurpose(
    db: OperationalDB,
    userId: string,
    purpose: string,
    now: Instant,
  ): Promise<ActionToken | null>;
}

export const ACTION_TOKEN_REPOSITORY = Symbol('ACTION_TOKEN_REPOSITORY');
