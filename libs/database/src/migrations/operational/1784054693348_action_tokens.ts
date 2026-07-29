import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- This table is designed to store action tokens for various purposes, such as email verification, password reset, email change, and magic login.

CREATE TABLE operational.action_tokens (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  user_id UUID NOT NULL REFERENCES operational.users(id) ON DELETE CASCADE,

  purpose VARCHAR(64) NOT NULL,
  token_hash VARCHAR(64) NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,

  revoked_at TIMESTAMPTZ,
  revoked_reason VARCHAR(64),

  version INT NOT NULL DEFAULT 0,

  CONSTRAINT chk_action_tokens_expiry
    CHECK (expires_at > created_at),
  CONSTRAINT chk_action_tokens_revocation
    CHECK (
      (revoked_at IS NULL AND revoked_reason IS NULL)
      OR (revoked_at IS NOT NULL AND revoked_reason IS NOT NULL)
    ),
  CONSTRAINT chk_action_tokens_consumption
    CHECK (consumed_at is NULL OR revoked_at IS NULL)
);

-- Indexes
CREATE UNIQUE INDEX ux_action_tokens_token_hash
  ON operational.action_tokens (token_hash);

CREATE INDEX idx_action_tokens_user_purpose
  ON operational.action_tokens (user_id, purpose);

CREATE INDEX idx_action_tokens_expires_at
  ON operational.action_tokens (expires_at);
      `,
    )
    .execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
DROP TABLE IF EXISTS operational.action_tokens;
      `,
    )
    .execute(db);
}
