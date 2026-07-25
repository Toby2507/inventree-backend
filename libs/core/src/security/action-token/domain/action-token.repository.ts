import type { OperationalDB } from '@app/database';
import type { Instant } from '@app/shared-kernel';
import type { ActionToken } from './aggregates/action-token.aggregate';

export interface ActionTokenRepository {
  create(db: OperationalDB, token: ActionToken): Promise<void>;
  update(db: OperationalDB, token: ActionToken): Promise<void>;
  findByHash(db: OperationalDB, hash: string): Promise<ActionToken | null>;
  findUsableByUserAndPurpose(
    db: OperationalDB,
    userId: string,
    purpose: string,
    now: Instant,
  ): Promise<ActionToken[]>;
}

export const TOKEN_REPOSITORY = Symbol('ACTION_TOKEN_REPOSITORY');
