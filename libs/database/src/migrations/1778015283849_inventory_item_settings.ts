import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Inventory rules for each product variant
-- Traceability defaults are in the product tables
-- Stock behaviour and costing policy defaults are in the store settings
-- Since this is just an overrides table use Just-in-Time creation logic
-- i.e only create a row in this table if user changes a setting from the default

CREATE TABLE operational.inventory_item_settings (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id),
  product_variant_id UUID NOT NULL REFERENCES operational.product_variants(id),

  -- Tracking & Traceability
  is_perishable BOOLEAN,
  track_inventory BOOLEAN,
  shelf_life_days INT,
  requires_lot_tracking BOOLEAN,
  requires_serial_tracking BOOLEAN,

  -- Stock Behavior
  allow_negative_inventory BOOLEAN,
  reorder_point DECIMAL(19,4),
  reorder_quantity DECIMAL(19,4),

  -- Costing Policy
  stock_valuation_method operational.stock_valuation_method,
  auto_update_cost BOOLEAN,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT fk_inventory_item_settings_product_variants
    FOREIGN KEY (store_id, product_variant_id)
    REFERENCES operational.product_variants(store_id, id)
    ON DELETE CASCADE,
  CONSTRAINT ux_inventory_item_settings_product_variant_id
    UNIQUE (product_variant_id),
  CONSTRAINT chk_store_products_shelf_life_nonnegative
    CHECK (shelf_life_days IS NULL OR shelf_life_days >= 0),
  CONSTRAINT chk_traceability_requires_inventory
    CHECK (
      (track_inventory IS NULL OR track_inventory = TRUE)
      OR (requires_lot_tracking = FALSE AND requires_serial_tracking = FALSE)
    ),
  CONSTRAINT chk_product_variants_reorder_nonnegative
    CHECK (
      (reorder_point IS NULL OR reorder_point >= 0)
      AND (reorder_quantity IS NULL OR reorder_quantity >= 0)
    )
);

-- Indexes
CREATE INDEX idx_inventory_item_settings_product_variant_id
  ON operational.inventory_item_settings (product_variant_id);

-- Triggers
CREATE TRIGGER trg_set_inventory_item_settings_updated_at
BEFORE UPDATE ON operational.inventory_item_settings
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS: (tenant-scoped)
ALTER TABLE operational.inventory_item_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.inventory_item_settings FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_inventory_item_settings ON operational.inventory_item_settings
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_inventory_item_settings_ins ON operational.inventory_item_settings
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
DROP TABLE IF EXISTS operational.inventory_item_settings;
      `,
    )
    .execute(db);
}
