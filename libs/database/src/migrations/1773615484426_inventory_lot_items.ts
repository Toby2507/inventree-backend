import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Fast lookup of on-hand quantity per lot per location.
-- Derivable from inventory_movement_lots + movements, but stored for speed.

CREATE TABLE operational.inventory_lot_items (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  product_variant_id UUID NOT NULL REFERENCES operational.product_variants(id) ON DELETE RESTRICT,
  lot_id UUID NOT NULL REFERENCES operational.inventory_lots(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES operational.store_locations(id) ON DELETE RESTRICT,

  -- NOTE: on_hand_qty can go negative if product_variant.allow_negative_inventory = TRUE.
  -- Non-negative enforcement is at application layer.
  on_hand_qty NUMERIC(19,6) NOT NULL DEFAULT 0,

  last_movement_at TIMESTAMPTZ,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,

  CONSTRAINT chk_inventory_lot_items_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object')
);

-- Indexes
CREATE UNIQUE INDEX ux_inventory_lot_items_lot_location_active
  ON operational.inventory_lot_items (store_id, lot_id, location_id);

CREATE INDEX idx_inventory_lot_items_location
  ON operational.inventory_lot_items (store_id, location_id);

CREATE INDEX idx_inventory_lot_items_lot
  ON operational.inventory_lot_items (store_id, lot_id);

CREATE INDEX idx_inventory_lot_items_store_variant
  ON operational.inventory_lot_items (store_id, product_variant_id)
  WHERE on_hand_qty > 0;

-- Triggers
CREATE TRIGGER trg_set_inventory_lot_items_updated_at
BEFORE UPDATE ON operational.inventory_lot_items
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS: (tenant-scoped)
ALTER TABLE operational.inventory_lot_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.inventory_lot_items FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_inventory_lot_items ON operational.inventory_lot_items
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_inventory_lot_items_ins ON operational.inventory_lot_items
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
DROP TABLE IF EXISTS operational.inventory_lot_items;
      `,
    )
    .execute(db);
}
