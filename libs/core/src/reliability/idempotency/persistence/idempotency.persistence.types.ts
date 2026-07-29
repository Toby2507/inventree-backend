import type { Instant, JsonValue } from '@app/shared-kernel';

export type IdempotencyStatus = 'in_progress' | 'completed' | 'failed';

export interface IdempotencyRecord {
  idempotencyKey: string;
  scope: string;
  requestHash: string;
  status: IdempotencyStatus;
  response: JsonValue;
  error: JsonValue;
  createdAt: Instant;
  expiresAt: Instant;
  resolvedAt: Instant | null;
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
