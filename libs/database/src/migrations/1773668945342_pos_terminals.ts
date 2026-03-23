import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- POS terminals registered to a store.
-- "device_fingerprint" lets you uniquely identify the device install.
-- "terminal_code" is a short human-friendly code used by staff.

CREATE TABLE operational.pos_terminals (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  created_by_store_member_id UUID REFERENCES operational.store_members(id) ON DELETE SET NULL,

  terminal_code TEXT NOT NULL,           -- e.g., "T1", "FRONT-01"
  device_fingerprint TEXT NOT NULL,      -- stable fingerprint from client app
  device_name TEXT,                      -- optional: "iPad Front Desk"
  platform TEXT,                         -- optional: "ios", "android", "web"
  app_version TEXT,                      -- optional client version for support

  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ,              -- heartbeat from client

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_pos_terminals_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object')
);

-- Indexes
CREATE INDEX idx_pos_terminals_store_id_id
  ON operational.pos_terminals (store_id, id DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX ux_pos_terminals_store_terminal_code_active
  ON operational.pos_terminals (store_id, terminal_code)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX ux_pos_terminals_device_fingerprint_active
  ON operational.pos_terminals (device_fingerprint)
  WHERE deleted_at IS NULL;

-- Triggers
CREATE TRIGGER trg_set_pos_terminals_updated_at
BEFORE UPDATE ON operational.pos_terminals
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS
ALTER TABLE operational.pos_terminals ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.pos_terminals FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_pos_terminals ON operational.pos_terminals
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_pos_terminals_ins ON operational.pos_terminals
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
DROP TABLE IF EXISTS operational.pos_terminals;
      `,
    )
    .execute(db);
}
