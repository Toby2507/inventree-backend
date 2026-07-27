import type { OperationalDB } from '@app/database';
import type { Instant } from '@app/shared-kernel';
import type { CreateOutboxEvent, OutboxEvent } from '../types/outbox.interface';

export interface OutboxRepository {
  insert(db: OperationalDB, record: CreateOutboxEvent): Promise<void>;
  claimBatch(
    db: OperationalDB,
    limit: number,
    lockedBy: string,
    lockDurationMs: number,
  ): Promise<OutboxEvent[]>;
  markPublished(db: OperationalDB, ids: string[], publishedBy: string): Promise<void>;
  markFailed(
    db: OperationalDB,
    id: string,
    error: string,
    nextAttemptAt: Instant,
    deadLetter: boolean,
  ): Promise<void>;
  releaseExpiredLocks(db: OperationalDB): Promise<number>;
}

export const OUTBOX_REPOSITORY = Symbol('OUTBOX_REPOSITORY');
