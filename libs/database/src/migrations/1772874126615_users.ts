import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
CREATE TYPE operational.user_status AS ENUM ('active', 'suspended', 'pending', 'disabled');

CREATE TABLE operational.users (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  email CITEXT NOT NULL,
  email_verified_at TIMESTAMPTZ,
  phone TEXT,
  phone_verified_at TIMESTAMPTZ,
  first_name TEXT,
  last_name  TEXT,
  display_name TEXT,
  status operational.user_status NOT NULL DEFAULT 'pending',
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

-- Uniqueness: ensure no two active (non-deleted) users share an email
CREATE UNIQUE INDEX ux_users_email_active
  ON operational.users (email)
  WHERE deleted_at IS NULL;

-- Additional indexes for common query patterns
CREATE INDEX idx_users_status
  ON operational.users (status)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_users_phone
  ON operational.users (phone)
  WHERE phone IS NOT NULL AND deleted_at IS NULL;

-- Trigger to update updated_at on row modification
CREATE TRIGGER trg_set_users_updated_at
BEFORE UPDATE ON operational.users
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
DROP TABLE IF EXISTS operational.users;
DROP TYPE IF EXISTS operational.user_status;
      `,
    )
    .execute(db);
}
