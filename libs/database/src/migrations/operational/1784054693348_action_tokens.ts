import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- This table is designed to store action tokens for various purposes, such as email verification, password reset, email change, and magic login.

CREATE TYPE operational.action_token_purpose AS ENUM (
  'email_verification',
  'password_reset',
  'email_change',
  'magic_login',
  'two_factor_auth'
);

CREATE TABLE operational.action_tokens (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  user_id UUID NOT NULL REFERENCES operational.users(id) ON DELETE CASCADE,

  purpose operational.action_token_purpose NOT NULL,
  token_hash CHAR(64) NOT NULL,

  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_action_tokens_expiry
    CHECK (expires_at > created_at)
);

-- Indexes
CREATE UNIQUE INDEX ux_action_tokens_token_hash
  ON operational.action_tokens (token_hash);

CREATE UNIQUE INDEX ux_action_tokens_active
  ON operational.action_tokens (user_id, purpose)
  WHERE used_at IS NULL;

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
DROP TYPE IF EXISTS operational.action_token_purpose;
      `,
    )
    .execute(db);
}
