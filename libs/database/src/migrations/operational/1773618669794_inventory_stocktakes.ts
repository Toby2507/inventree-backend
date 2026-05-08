import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Stocktake aggregate: count items at a location and reconcile differences.
-- Closing a stocktake creates stocktake_adjust movements per product.

CREATE TYPE operational.stocktake_status AS ENUM ('draft', 'in_progress', 'completed', 'cancelled');

CREATE TABLE operational.inventory_stocktakes (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  created_by_store_member_id UUID REFERENCES operational.store_members(id) ON DELETE SET NULL,
  -- NULL = store-wide stocktake (all locations)
  -- NOT NULL = scoped to a specific location
  location_id UUID REFERENCES operational.store_locations(id) ON DELETE RESTRICT,

  status operational.stocktake_status NOT NULL DEFAULT 'draft',

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_inventory_stocktakes_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT chk_stocktake_status_timestamps
    CHECK (
      (status = 'draft' AND started_at IS NULL AND completed_at IS NULL)
      OR (status = 'in_progress' AND started_at IS NOT NULL AND completed_at IS NULL)
      OR (status = 'completed' AND started_at IS NOT NULL AND completed_at IS NOT NULL)
      OR (status = 'cancelled')
  )
);

-- Indexes
CREATE INDEX idx_inventory_stocktakes_store_id_id
  ON operational.inventory_stocktakes (store_id, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_inventory_stocktakes_store_status
  ON operational.inventory_stocktakes (store_id, status)
  WHERE deleted_at IS NULL;

-- Triggers
CREATE TRIGGER trg_set_inventory_stocktakes_updated_at
BEFORE UPDATE ON operational.inventory_stocktakes
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS: (tenant-scoped)
ALTER TABLE operational.inventory_stocktakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.inventory_stocktakes FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_inventory_stocktakes ON operational.inventory_stocktakes
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_inventory_stocktakes_ins ON operational.inventory_stocktakes
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
DROP TABLE IF EXISTS operational.inventory_stocktakes;
DROP TYPE IF EXISTS operational.stocktake_status;
      `,
    )
    .execute(db);
}
