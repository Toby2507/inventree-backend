import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Materialized on-hand totals per (store_product, location).
-- This is a cache for fast reads. The ledger is inventory_movements.

CREATE TABLE operational.inventory_items (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  product_variant_id UUID NOT NULL REFERENCES operational.product_variants(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES operational.store_locations(id) ON DELETE RESTRICT,

  -- NOTE: on_hand_qty can go negative if product_variant.allow_negative_inventory = TRUE.
  -- Non-negative enforcement is at application layer, not database level.
  on_hand_qty NUMERIC(19,6) NOT NULL DEFAULT 0,   -- current quantity at this location
  reserved_qty NUMERIC(19,6) NOT NULL DEFAULT 0,  -- future: holds/reservations (optional)
  -- available = on_hand - reserved (compute in query; keep reserved for future without schema changes)

  last_movement_at TIMESTAMPTZ, -- helps debugging and incremental rebuild jobs

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,

  CONSTRAINT chk_inventory_items_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT chk_inventory_items_reserved_nonnegative
    CHECK (reserved_qty >= 0)
);

-- Indexes
CREATE UNIQUE INDEX ux_inventory_items_product_location_active
  ON operational.inventory_items (store_id, product_variant_id, location_id);

CREATE INDEX idx_inventory_items_store_product
  ON operational.inventory_items (store_id, product_variant_id);

CREATE INDEX idx_inventory_items_store_location
  ON operational.inventory_items (store_id, location_id);

-- Triggers
CREATE TRIGGER trg_set_inventory_items_updated_at
BEFORE UPDATE ON operational.inventory_items
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS: (tenant-scoped)
ALTER TABLE operational.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.inventory_items FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_inventory_items ON operational.inventory_items
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_inventory_items_ins ON operational.inventory_items
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
DROP TABLE IF EXISTS operational.inventory_items;
      `,
    )
    .execute(db);
}
