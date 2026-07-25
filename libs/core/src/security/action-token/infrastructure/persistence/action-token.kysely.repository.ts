import {
  isUniqueViolation,
  type OperationalDB,
  OptimisticConcurrencyControlException,
} from '@app/database';
import type { Instant } from '@app/shared-kernel';
import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import type { ActionTokenRepository } from '../../domain/action-token.repository';
import { ActionToken } from '../../domain/aggregates/action-token.aggregate';
import type {
  ActionTokenPurpose,
  ActionTokenRevokeReason,
} from '../../domain/aggregates/action-token.types';
import { DuplicateTokenHashException } from '../exceptions/persistence.exception';
import { ActionTokenMapper } from '../persistence/action-token.mapper';

@Injectable()
export class ActionTokenKyselyRepository implements ActionTokenRepository {
  private readonly mapper = new ActionTokenMapper();

  async create(db: OperationalDB, token: ActionToken): Promise<void> {
    const row = this.mapper.toPersistence(token);
    try {
      await db.insertInto('action_tokens').values(row).execute();
    } catch (error: unknown) {
      if (isUniqueViolation(error, 'ux_action_tokens_token_hash'))
        throw new DuplicateTokenHashException(error);
      throw error;
    }
  }

  async update(db: OperationalDB, token: ActionToken): Promise<void> {
    const row = this.mapper.toPersistence(token);
    const { numUpdatedRows } = await db
      .updateTable('action_tokens')
      .set(row)
      .where('id', '=', row.id)
      .where('version', '=', row.version - 1)
      .executeTakeFirst();
    if (Number(numUpdatedRows) === 0)
      throw new OptimisticConcurrencyControlException(ActionToken.name, token.id.value);
  }

  async findByHash(db: OperationalDB, hash: string): Promise<ActionToken | null> {
    const row = await db
      .selectFrom('action_tokens')
      .selectAll()
      .where('token_hash', '=', hash)
      .executeTakeFirst();
    return row ? this.mapper.toDomain(row) : null;
  }

  async findUsableByUserAndPurpose(
    db: OperationalDB,
    userId: string,
    purpose: ActionTokenPurpose,
    now: Instant,
  ): Promise<ActionToken[]> {
    const rows = await db
      .selectFrom('action_tokens')
      .selectAll()
      .where('user_id', '=', userId)
      .where('purpose', '=', purpose)
      .where('revoked_at', 'is', null)
      .where('consumed_at', 'is', null)
      .where('expires_at', '>', now.toDate())
      .orderBy('created_at', 'desc')
      .execute();
    return this.mapper.toDomainBulk(rows);
  }

  async findUsableByUser(db: OperationalDB, userId: string, now: Instant): Promise<ActionToken[]> {
    const rows = await db
      .selectFrom('action_tokens')
      .selectAll()
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null)
      .where('consumed_at', 'is', null)
      .where('expires_at', '>', now.toDate())
      .orderBy('created_at', 'desc')
      .execute();
    return this.mapper.toDomainBulk(rows);
  }

  async findById(db: OperationalDB, id: string): Promise<ActionToken | null> {
    const row = await db
      .selectFrom('action_tokens')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? this.mapper.toDomain(row) : null;
  }

  async revokeUsableByIds(
    db: OperationalDB,
    ids: string[],
    reason: ActionTokenRevokeReason,
    now: Instant,
  ): Promise<void> {
    if (ids.length === 0) return;
    await db
      .updateTable('action_tokens')
      .set({ revoked_at: now.toDate(), revoked_reason: reason, version: sql`version + 1` })
      .where('id', 'in', ids)
      .where('revoked_at', 'is', null)
      .where('consumed_at', 'is', null)
      .executeTakeFirst();
  }
}
