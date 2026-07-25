import { Instant, Mapper } from '@app/shared-kernel';
import { ActionToken } from '../../domain/aggregates/action-token.aggregate';
import {
  ActionTokenPurpose,
  ActionTokenRevokeReason,
} from '../../domain/aggregates/action-token.types';
import { ActionTokenRow } from './action-token.persistence.types';

export class ActionTokenMapper extends Mapper<ActionToken, ActionTokenRow> {
  toDomain(raw: ActionTokenRow): ActionToken {
    return ActionToken.reconstitute({
      id: raw.id,
      userId: raw.user_id,
      purpose: raw.purpose as ActionTokenPurpose,
      tokenHash: raw.token_hash,
      createdAt: Instant.fromDate(raw.created_at),
      expiresAt: Instant.fromDate(raw.expires_at),
      consumedAt: raw.consumed_at ? Instant.fromDate(raw.consumed_at) : null,
      revokedAt: raw.revoked_at ? Instant.fromDate(raw.revoked_at) : null,
      revokedReason: raw.revoked_reason as ActionTokenRevokeReason | null,
      version: raw.version,
    });
  }

  toPersistence(entity: ActionToken): ActionTokenRow {
    const snapshot = entity.toSnapshot();
    return {
      id: snapshot.id,
      user_id: snapshot.userId,
      purpose: snapshot.purpose,
      token_hash: snapshot.tokenHash,
      created_at: snapshot.createdAt.toDate(),
      expires_at: snapshot.expiresAt.toDate(),
      consumed_at: snapshot.consumedAt ? snapshot.consumedAt.toDate() : null,
      revoked_at: snapshot.revokedAt ? snapshot.revokedAt.toDate() : null,
      revoked_reason: snapshot.revokedReason,
      version: snapshot.version,
    };
  }
}
