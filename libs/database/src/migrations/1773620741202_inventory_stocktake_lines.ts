import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Stocktake lines: counted quantity per product.
-- expected_qty can be snapshotted at count time for audit (optional but valuable).

CREATE TABLE operational.inventory_stocktake_lines (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  product_variant_id UUID NOT NULL REFERENCES operational.product_variants(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES operational.store_locations(id) ON DELETE RESTRICT,
  stocktake_id UUID NOT NULL REFERENCES operational.inventory_stocktakes(id) ON DELETE CASCADE,

  expected_qty NUMERIC(19,6), -- snapshot from inventory_items at time of count (optional)
  -- Zero is valid: means product was counted and none were found.
  -- NULL would mean product was not yet counted.
  counted_qty NUMERIC(19,6), -- NULL = not yet counted; 0 = counted, none found

  notes TEXT,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_inventory_stocktake_lines_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object')
);

-- Indexes
CREATE UNIQUE INDEX ux_inventory_stocktake_lines_stocktake_variant_location
  ON operational.inventory_stocktake_lines (stocktake_id, product_variant_id, location_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_inventory_stocktake_lines_stocktake
  ON operational.inventory_stocktake_lines (store_id, stocktake_id)
  WHERE deleted_at IS NULL;

-- Triggers
CREATE TRIGGER trg_set_inventory_stocktake_lines_updated_at
BEFORE UPDATE ON operational.inventory_stocktake_lines
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS: (tenant-scoped)
ALTER TABLE operational.inventory_stocktake_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.inventory_stocktake_lines FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_inventory_stocktake_lines ON operational.inventory_stocktake_lines
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_inventory_stocktake_lines_ins ON operational.inventory_stocktake_lines
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
DROP TABLE IF EXISTS operational.inventory_stocktake_lines;
      `,
    )
    .execute(db);
}
