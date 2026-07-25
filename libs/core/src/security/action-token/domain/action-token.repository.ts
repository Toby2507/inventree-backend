import type { OperationalDB } from '@app/database';
import type { Instant } from '@app/shared-kernel';
import type { ActionToken } from './aggregates/action-token.aggregate';
import { ActionTokenRevokeReason } from './aggregates/action-token.types';

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
  findUsableByUser(db: OperationalDB, userId: string, now: Instant): Promise<ActionToken[]>;
  findById(db: OperationalDB, id: string): Promise<ActionToken | null>;
  revokeUsableByIds(
    db: OperationalDB,
    ids: string[],
    reason: ActionTokenRevokeReason,
    now: Instant,
  ): Promise<void>;
}

export const TOKEN_REPOSITORY = Symbol('ACTION_TOKEN_REPOSITORY');
