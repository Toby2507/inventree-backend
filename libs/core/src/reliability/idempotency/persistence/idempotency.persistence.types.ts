import { JsonValue } from '@app/common/types';

export type IdempotencyStatus = 'in_progress' | 'completed' | 'failed';

export interface IdempotencyRecord {
  idempotencyKey: string;
  scope: string;
  requestHash: string;
  status: IdempotencyStatus;
  response: JsonValue;
  error: JsonValue;
  createdAt: Date;
  expiresAt: Date;
  resolvedAt: Date | null;
}

export interface IdempotencyRedisRecord {
  requestHash: string;
  status: IdempotencyStatus;
  response?: JsonValue;
  error?: JsonValue;
}

export interface IdempotencyRow {
  idempotency_key: string;
  scope: string;
  request_hash: string;
  status: IdempotencyStatus;
  response: JsonValue;
  error: JsonValue;
  created_at: Date;
  expires_at: Date;
  resolved_at: Date | null;
}

export interface CreateIdempotency {
  key: string;
  scope: string;
  hash: string;
  ttl: number;
}

export type CreateIdempotencyResult =
  | { created: true; record: IdempotencyRecord }
  | { created: false };
