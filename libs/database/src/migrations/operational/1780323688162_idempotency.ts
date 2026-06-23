import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- This table is designed to support idempotent operations in the application.

CREATE TYPE operational.idempotency_status AS ENUM ('in_progress', 'completed', 'failed');

CREATE TABLE operational.idempotency (
  idempotency_key TEXT NOT NULL,
  scope TEXT NOT NULL,

  request_hash CHAR(64) NOT NULL,  -- request fingerprint (hash of body + maybe headers)
  status operational.idempotency_status NOT NULL DEFAULT 'in_progress',
  response JSONB,
  error JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,

  CONSTRAINT pk_idempotency PRIMARY KEY (idempotency_key, scope),
  CONSTRAINT chk_idempotency_response_or_error
    CHECK (
      (status = 'completed' AND response IS NOT NULL AND error IS NULL AND resolved_at IS NOT NULL)
      OR (status = 'failed' AND response IS NULL AND error IS NOT NULL AND resolved_at IS NOT NULL)
      OR (status = 'in_progress' AND response IS NULL AND error IS NULL AND resolved_at IS NULL)
    )
);

-- Indexes
CREATE INDEX idx_idempotency_expires
  ON operational.idempotency (expires_at);

CREATE INDEX idx_idempotency_in_progress
  ON operational.idempotency (status, created_at)
  WHERE status = 'in_progress';
      `,
    )
    .execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
DROP TABLE IF EXISTS operational.idempotency;
DROP TYPE IF EXISTS operational.idempotency_status;
      `,
    )
    .execute(db);
}
