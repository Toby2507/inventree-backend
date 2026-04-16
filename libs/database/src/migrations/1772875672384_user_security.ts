import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
CREATE TYPE operational.mfa_type AS ENUM ('email', 'totp');
CREATE TYPE operational.mfa_status AS ENUM ('pending', 'enabled', 'disabled');

CREATE TABLE operational.user_security (
  user_id UUID PRIMARY KEY REFERENCES operational.users(id) ON DELETE CASCADE,

  -- Brute-force / credential stuffing protection
  failed_login_attempts INT NOT NULL DEFAULT 0,
  last_login_attempted_at TIMESTAMPTZ,
  lockout_until TIMESTAMPTZ,
  lockout_reason TEXT, -- human-readable reason (e.g., 'too_many_failed_attempts')

  -- Password lifecycle
  last_password_change_at TIMESTAMPTZ, -- set on password set/rotate

  -- MFA: single configuration per user (nullable = MFA not enabled)
  mfa_status operational.mfa_status NOT NULL DEFAULT 'disabled',
  mfa_type operational.mfa_type,
  mfa_secret_ciphertext BYTEA,   -- encrypted TOTP secret (never store plaintext)
  mfa_secret_kid TEXT,           -- key identifier used for encryption (supports key rotation)
  mfa_enabled_at TIMESTAMPTZ,
  mfa_last_used_at TIMESTAMPTZ,  -- last successful MFA verification time (audit/security signal)

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT ux_user_security_user UNIQUE (user_id),
  -- Consistency checks for MFA fields
  CONSTRAINT chk_mfa_fields_consistent CHECK (
    (mfa_status = 'disabled' AND mfa_enabled_at IS NULL)
    OR
    (mfa_status = 'pending' AND mfa_enabled_at IS NULL)
    OR
    (mfa_status = 'enabled' AND mfa_enabled_at IS NOT NULL)
  )
);

-- Indexes
-- No additional indexes needed for now since user_id is PK 
-- and we don't have queries filtering by other fields yet

-- Trigger to cascade soft-delete to related user_security row
CREATE OR REPLACE FUNCTION operational.cascade_user_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE operational.user_security
    SET deleted_at = NEW.deleted_at
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cascade_user_soft_delete
AFTER UPDATE ON operational.users
FOR EACH ROW
EXECUTE FUNCTION operational.cascade_user_soft_delete();

-- Trigger to update updated_at on row modification
CREATE TRIGGER trg_set_user_security_updated_at
BEFORE UPDATE ON operational.user_security
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();
      `,
    )
    .execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
DROP TRIGGER IF EXISTS trg_cascade_user_soft_delete ON operational.users;
DROP FUNCTION IF EXISTS operational.cascade_user_soft_delete;
DROP TABLE IF EXISTS operational.user_security;
DROP TYPE IF EXISTS operational.mfa_type;
DROP TYPE IF EXISTS operational.mfa_status;
      `,
    )
    .execute(db);
}
