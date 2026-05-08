import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Transfer aggregate: moving stock between two locations within the same store.
-- Completing a transfer generates:
-- - transfer_out movement(s) at from_location
-- - transfer_in movement(s) at to_location

CREATE TYPE operational.inventory_transfer_status AS ENUM ('draft', 'submitted', 'completed', 'cancelled');

CREATE TABLE operational.inventory_transfers (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  created_by_store_member_id UUID REFERENCES operational.store_members(id) ON DELETE SET NULL,

  status operational.inventory_transfer_status NOT NULL DEFAULT 'draft',

  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_inventory_transfers_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT chk_inventory_transfers_status_timestamps
    CHECK (
      (status = 'draft' AND submitted_at IS NULL AND completed_at IS NULL)
      OR (status = 'submitted' AND submitted_at IS NOT NULL AND completed_at IS NULL)
      OR (status = 'completed' AND submitted_at IS NOT NULL AND completed_at IS NOT NULL)
      OR (status = 'cancelled')
    )
);

-- Indexes
CREATE INDEX idx_inventory_transfers_store_id_id
  ON operational.inventory_transfers (store_id, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_inventory_transfers_store_status
  ON operational.inventory_transfers (store_id, status)
  WHERE deleted_at IS NULL;

-- Triggers
CREATE TRIGGER trg_set_inventory_transfers_updated_at
BEFORE UPDATE ON operational.inventory_transfers
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS: (tenant-scoped)
ALTER TABLE operational.inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.inventory_transfers FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_inventory_transfers ON operational.inventory_transfers
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_inventory_transfers_ins ON operational.inventory_transfers
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
DROP TABLE IF EXISTS operational.inventory_transfers;
DROP TYPE IF EXISTS operational.inventory_transfer_status;
      `,
    )
    .execute(db);
}
