import { JsonValue } from '@app/common/types';
import { OperationalDB } from '@app/database';
import {
  CreateIdempotency,
  CreateIdempotencyResult,
  IdempotencyRecord,
} from './idempotency.persistence.types';

export interface IdempotencyRepository {
  create(db: OperationalDB, record: CreateIdempotency): Promise<CreateIdempotencyResult>;
  findActiveRecord(
    db: OperationalDB,
    key: string,
    scope: string,
  ): Promise<IdempotencyRecord | null>;
  markCompleted(
    db: OperationalDB,
    key: string,
    scope: string,
    response: JsonValue,
  ): Promise<IdempotencyRecord | null>;
  markFailed(
    db: OperationalDB,
    key: string,
    scope: string,
    error: JsonValue,
  ): Promise<IdempotencyRecord | null>;
  deleteExpired(db: OperationalDB): Promise<void>;
  deleteRecord(db: OperationalDB, key: string, scope: string): Promise<void>;
  sweepStaleInProgress(db: OperationalDB): Promise<void>;
}

export const IDEMPOTENCY_REPOSITORY = Symbol('IDEMPOTENCY_REPOSITORY');
