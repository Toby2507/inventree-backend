import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
CREATE TYPE operational.store_role AS ENUM ('owner', 'administrator', 'staff', 'attendant');
CREATE TYPE operational.store_member_status AS ENUM ('active', 'suspended');

CREATE TABLE operational.store_members (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES operational.users(id) ON DELETE CASCADE,
  role operational.store_role NOT NULL,
  status operational.store_member_status NOT NULL DEFAULT 'active',
  pin_hash TEXT,          -- POS PIN hash (only for attendants, nullable otherwise)
  pin_set_at TIMESTAMPTZ,
  last_pin_login_at TIMESTAMPTZ,
  last_pin_login_ip INET,
  permission_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  notification_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_store_member_overrides_object
    CHECK (jsonb_typeof(permission_overrides) = 'object'),
  CONSTRAINT chk_store_member_notification_prefs_object
    CHECK (jsonb_typeof(notification_preferences) = 'object'),
  CONSTRAINT chk_pin_fields_consistent
    CHECK (
      (pin_hash IS NULL AND pin_set_at IS NULL)
      OR
      (pin_hash IS NOT NULL AND pin_set_at IS NOT NULL)
    ),
  -- Enforce POS rule: active attendants must have a PIN.
  CONSTRAINT chk_attendant_pin_when_active
    CHECK (NOT (status = 'active' AND role = 'attendant' AND pin_hash IS NULL))
);

CREATE UNIQUE INDEX ux_store_members_store_user_active
  ON operational.store_members (store_id, user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_store_members_store_role
  ON operational.store_members (store_id, role)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_store_members_store_status
  ON operational.store_members (store_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_store_members_user
  ON operational.store_members (user_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_set_store_members_updated_at
BEFORE UPDATE ON operational.store_members
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS: tenant-scoped by app.current_store_id (your standard).
ALTER TABLE operational.store_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.store_members FORCE ROW LEVEL SECURITY;

-- For SELECT, UPDATE, DELETE: ensure users can only see/modify members of the current store context.
CREATE POLICY tenant_isolation_store_members ON operational.store_members
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

-- For INSERT: ensure new rows can only be added within the current store context.
CREATE POLICY tenant_isolation_store_members_ins ON operational.store_members
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
DROP TABLE IF EXISTS operational.store_members;
DROP TYPE IF EXISTS operational.store_role;
DROP TYPE IF EXISTS operational.store_member_status;
      `,
    )
    .execute(db);
}
