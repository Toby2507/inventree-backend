import type { OperationalDB } from '@app/database';
import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import type { OutboxRepository } from '../ports/repository.port';
import type { CreateOutboxEvent, OutboxEvent } from '../types/outbox.interface';
import { OutboxEventMapper } from './outbox.mapper';

@Injectable()
export class OutboxKyselyRepository implements OutboxRepository {
  private readonly mapper = new OutboxEventMapper();

  async insert(db: OperationalDB, record: CreateOutboxEvent): Promise<void> {
    const events = this.mapper.toPublish(record);
    await db.insertInto('outbox_events').values(events).execute();
  }

  async claimBatch(
    db: OperationalDB,
    limit: number,
    lockedBy: string,
    lockDurationMs: number,
  ): Promise<OutboxEvent[]> {
    const rows = await db
      .updateTable('outbox_events')
      .set({
        status: 'locked',
        locked_at: sql`now()`,
        locked_by: lockedBy,
        lock_expires_at: sql`now() + (${lockDurationMs}::int * interval '1 millisecond')`,
      })
      .where('id', 'in', (eb) =>
        eb
          .selectFrom('outbox_events')
          .select('id')
          .where('status', '=', 'pending')
          .where('next_attempt_at', '<=', sql<Date>`now()`)
          .orderBy('occurred_at', 'asc')
          .limit(limit)
          .forUpdate()
          .skipLocked(),
      )
      .returningAll()
      .execute();
    return this.mapper.toDomainBulk(rows);
  }

  async markPublished(db: OperationalDB, ids: string[], publishedBy: string): Promise<void> {
    if (!ids.length) return;
    await db
      .updateTable('outbox_events')
      .set({
        status: 'published',
        published_at: sql`now()`,
        publish_ref: publishedBy,
        locked_at: null,
        locked_by: null,
        lock_expires_at: null,
      })
      .where('id', 'in', ids)
      .execute();
  }

  async markFailed(
    db: OperationalDB,
    id: string,
    error: string,
    nextAttemptAt: Date,
    deadLetter: boolean,
  ): Promise<void> {
    await db
      .updateTable('outbox_events')
      .set({
        status: deadLetter ? 'failed' : 'pending',
        publish_attempts: sql`publish_attempts + 1`,
        last_error: error,
        last_error_at: sql`now()`,
        next_attempt_at: deadLetter ? null : nextAttemptAt,
        locked_at: null,
        locked_by: null,
        lock_expires_at: null,
      })
      .where('id', '=', id)
      .execute();
  }

  async releaseExpiredLocks(db: OperationalDB): Promise<number> {
    const [{ numUpdatedRows }] = await db
      .updateTable('outbox_events')
      .set({
        status: 'pending',
        locked_at: null,
        locked_by: null,
        lock_expires_at: null,
      })
      .where('status', '=', 'locked')
      .where('lock_expires_at', '<', new Date())
      .execute();
    return Number(numUpdatedRows ?? 0);
  }
}
