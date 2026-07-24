import {
  isUniqueViolation,
  OperationalDB,
  OptimisticConcurrencyControlException,
} from '@app/database';
import { Instant } from '@app/shared-kernel';
import { Injectable } from '@nestjs/common';
import { ActionToken } from '../domain/action-token.aggregate';
import { ActionTokenRepository } from '../domain/action-token.repository';
import { DuplicateTokenHashException } from './action-token.exception';
import { ActionTokenMapper } from './action-token.mapper';
import { ActionTokenPurpose } from '../domain/action-token.types';

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

  async findActiveByUserAndPurpose(
    db: OperationalDB,
    userId: string,
    purpose: ActionTokenPurpose,
    now: Instant,
  ): Promise<ActionToken | null> {
    const row = await db
      .selectFrom('action_tokens')
      .selectAll()
      .where('user_id', '=', userId)
      .where('purpose', '=', purpose)
      .where('revoked_at', 'is', null)
      .where('consumed_at', 'is', null)
      .where('expires_at', '>', now.toDate())
      .orderBy('created_at', 'desc')
      .limit(1)
      .executeTakeFirst();
    return row ? this.mapper.toDomain(row) : null;
  }
}
