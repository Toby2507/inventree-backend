import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Lots/batches for products requiring lot tracking.
-- Lot identity is store-level per product. Quantity by lot is derived from movement allocations.

CREATE TABLE operational.inventory_lots (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  product_variant_id UUID NOT NULL REFERENCES operational.product_variants(id) ON DELETE RESTRICT,

  lot_code TEXT NOT NULL, -- batch/lot identifier, e.g., "LOT-2026-02-ABC"
  manufactured_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_inventory_lots_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object')
);

-- Indexes
CREATE UNIQUE INDEX ux_inventory_lots_product_variants_lot_active
  ON operational.inventory_lots (store_id, product_variant_id, lot_code)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_inventory_lots_product_variants
  ON operational.inventory_lots (store_id, product_variant_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_inventory_lots_expiry
  ON operational.inventory_lots (store_id, product_variant_id, expires_at ASC NULLS LAST)
  WHERE deleted_at IS NULL AND expires_at IS NOT NULL;

-- Triggers
CREATE TRIGGER trg_set_inventory_lots_updated_at
BEFORE UPDATE ON operational.inventory_lots
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS: (tenant-scoped)
ALTER TABLE operational.inventory_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.inventory_lots FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_inventory_lots ON operational.inventory_lots
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_inventory_lots_ins ON operational.inventory_lots
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
DROP TABLE IF EXISTS operational.inventory_lots;
      `,
    )
    .execute(db);
}
