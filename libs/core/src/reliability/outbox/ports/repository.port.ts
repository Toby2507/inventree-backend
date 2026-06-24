import { OperationalDB } from '@app/database';
import { CreateOutboxEvent, OutboxEvent } from '../types/outbox.interface';

export interface OutboxRepository {
  insert(db: OperationalDB, record: CreateOutboxEvent): Promise<void>;
  claimBatch(
    db: OperationalDB,
    limit: number,
    lockedBy: string,
    lockDuratonMs: number,
  ): Promise<OutboxEvent[]>;
  markPublished(db: OperationalDB, ids: string[], publishedBy: string): Promise<void>;
  markFailed(
    db: OperationalDB,
    id: string,
    error: string,
    nextAttemptAt: Date,
    deadLetter: boolean,
  ): Promise<void>;
  releaseExpiredLocks(db: OperationalDB): Promise<void>;
}

export const OUTBOX_REPOSITORY = Symbol('OUTBOX_REPOSITORY');
