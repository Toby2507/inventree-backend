import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Pending invite to join a store with a role.
-- This supports "invite by email" without creating a user upfront.
-- We store the invite token hashed (never plaintext) to avoid leaking usable credentials.

CREATE TYPE operational.store_invitation_status AS ENUM ('pending', 'revoked', 'accepted', 'expired');

CREATE TABLE operational.store_invitations (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  invited_by_store_member_id UUID REFERENCES operational.store_members(id) ON DELETE SET NULL,
  accepted_by_user_id UUID REFERENCES operational.users(id) ON DELETE SET NULL, -- set when accepted
  email CITEXT NOT NULL, -- invite target
  role operational.store_role NOT NULL,
  status operational.store_invitation_status NOT NULL DEFAULT 'pending',
  token_hash TEXT NOT NULL,       -- hash of invite token (store only hash)
  expires_at TIMESTAMPTZ NOT NULL, -- enforce TTL
  accepted_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb, -- optional context (e.g., message)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_store_invite_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT chk_invite_acceptance_consistency
    CHECK (
      (status <> 'accepted' AND accepted_at IS NULL AND accepted_by_user_id IS NULL)
      OR
      (status = 'accepted' AND accepted_at IS NOT NULL AND accepted_by_user_id IS NOT NULL)
    )
);

-- Prevent multiple active pending invites for same email in same store
CREATE UNIQUE INDEX ux_store_invitations_store_email_pending
  ON operational.store_invitations (store_id, email)
  WHERE deleted_at IS NULL AND status = 'pending';

-- Tenant-leading index
CREATE INDEX idx_store_invitations_store_status
  ON operational.store_invitations (store_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_store_invitations_expires
  ON operational.store_invitations (expires_at)
  WHERE deleted_at IS NULL AND status = 'pending';

CREATE TRIGGER trg_set_store_invitations_updated_at
BEFORE UPDATE ON operational.store_invitations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- RLS: tenant-scoped by app.current_store_id (your standard).
ALTER TABLE operational.store_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.store_invitations FORCE ROW LEVEL SECURITY;

-- For SELECT, UPDATE, DELETE: ensure store_id matches current tenant
CREATE POLICY tenant_isolation_store_invitations ON operational.store_invitations
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

-- For INSERT: ensure new rows can only be added within the current tenant context.
CREATE POLICY tenant_isolation_store_invitations_ins ON operational.store_invitations
  FOR INSERT
  WITH CHECK (store_id = current_setting('app.current_store_id', true)::UUID);
      `,
    )
    .execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
DROP TABLE IF EXISTS operational.store_invitations;
DROP TYPE IF EXISTS operational.store_invitation_status;
      `,
    )
    .execute(db);
}
