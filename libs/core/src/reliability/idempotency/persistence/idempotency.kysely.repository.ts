import { JsonValue } from '@app/common/types';
import { OperationalDB } from '@app/database';
import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import {
  CreateIdempotency,
  CreateIdempotencyResult,
  IdempotencyRecord,
  IdempotencyRow,
} from './idempotency.persistence.types';
import { IdempotencyRepository } from './idempotency.port';

@Injectable()
export class IdempotencyKyselyRepository implements IdempotencyRepository {
  async create(db: OperationalDB, record: CreateIdempotency): Promise<CreateIdempotencyResult> {
    const result = await db
      .insertInto('idempotency')
      .values({
        idempotency_key: record.key,
        scope: record.scope,
        request_hash: record.hash,
        status: 'in_progress',
        expires_at: sql`now() + (${record.ttl} * interval '1 second')`,
      })
      .onConflict((oc) => oc.columns(['idempotency_key', 'scope']).doNothing())
      .returningAll()
      .execute();
    if (result.length > 0) return { created: true, record: this.toRecord(result[0]) };
    return { created: false };
  }

  async findActiveRecord(
    db: OperationalDB,
    key: string,
    scope: string,
  ): Promise<IdempotencyRecord | null> {
    const raw = await db
      .selectFrom('idempotency')
      .selectAll()
      .where('idempotency_key', '=', key)
      .where('scope', '=', scope)
      .where('expires_at', '>', new Date())
      .executeTakeFirst();
    return raw ? this.toRecord(raw) : null;
  }

  async markCompleted(
    db: OperationalDB,
    key: string,
    scope: string,
    response: JsonValue,
  ): Promise<IdempotencyRecord | null> {
    const raw = await db
      .updateTable('idempotency')
      .set({
        status: 'completed',
        response,
        resolved_at: sql`now()`,
      })
      .where('idempotency_key', '=', key)
      .where('scope', '=', scope)
      .where('status', '=', 'in_progress')
      .where('expires_at', '>', new Date())
      .returningAll()
      .execute();
    return raw.length > 0 ? this.toRecord(raw[0]) : null;
  }

  async markFailed(
    db: OperationalDB,
    key: string,
    scope: string,
    error: JsonValue,
  ): Promise<IdempotencyRecord | null> {
    const raw = await db
      .updateTable('idempotency')
      .set({
        status: 'failed',
        error,
        resolved_at: sql`now()`,
      })
      .where('idempotency_key', '=', key)
      .where('scope', '=', scope)
      .where('status', '=', 'in_progress')
      .where('expires_at', '>', new Date())
      .returningAll()
      .execute();
    return raw.length > 0 ? this.toRecord(raw[0]) : null;
  }

  async deleteRecord(db: OperationalDB, key: string, scope: string): Promise<void> {
    await db
      .deleteFrom('idempotency')
      .where('idempotency_key', '=', key)
      .where('scope', '=', scope)
      .execute();
  }

  async deleteExpired(db: OperationalDB): Promise<void> {
    await db.deleteFrom('idempotency').where('expires_at', '<', new Date()).execute();
  }

  async sweepStaleInProgress(db: OperationalDB): Promise<void> {
    const threshold = new Date(Date.now() - 5 * 60 * 1000);
    await db
      .updateTable('idempotency')
      .set({ status: 'failed', error: { message: 'Request timed out' }, resolved_at: sql`now()` })
      .where('status', '=', 'in_progress')
      .where('created_at', '<', threshold)
      .execute();
  }

  private toRecord(raw: IdempotencyRow): IdempotencyRecord {
    return {
      idempotencyKey: raw.idempotency_key,
      scope: raw.scope,
      requestHash: raw.request_hash,
      status: raw.status,
      response: raw.response,
      error: raw.error,
      createdAt: raw.created_at,
      expiresAt: raw.expires_at,
      resolvedAt: raw.resolved_at,
    };
  }
}
