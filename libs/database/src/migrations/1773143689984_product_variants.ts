import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Sellable SKUs for a product.
-- Every product has at least one variant even if it has no options (simple product).
-- Variants own pricing, costing, inventory behavior, and barcode.

CREATE TABLE operational.product_variants (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES operational.products(id) ON DELETE CASCADE,
  barcode_registry_id UUID REFERENCES operational.barcode_registry(id) ON DELETE SET NULL,
  created_by_store_member_id UUID REFERENCES operational.store_members(id) ON DELETE SET NULL,

  sku TEXT,
  barcode TEXT,

  -- Display name combines option values e.g. "Red / Large"
  -- Computed and stored for display performance, updated at app layer when options change
  display_name TEXT NOT NULL,
  normalized_display_name TEXT NOT NULL,

  -- Measurement details
  unit_precision SMALLINT NOT NULL DEFAULT 0,
  pack_size TEXT,

  -- Pricing
  selling_price DECIMAL(19,4) NOT NULL,
  min_selling_price DECIMAL(19,4),

  -- Costing
  cost_price DECIMAL(19,4),
  cost_updated_at TIMESTAMPTZ,
  -- Inherits from store_settings.stock_valuation_method if not overridden
  stock_valuation_method operational.stock_valuation_method NOT NULL DEFAULT 'weighted_average',
  -- Whether to auto-update cost_price on new inventory transactions
  auto_update_cost BOOLEAN NOT NULL DEFAULT TRUE,

  -- Inventory behavior
  allow_negative_inventory BOOLEAN NOT NULL DEFAULT FALSE,
  allow_discount BOOLEAN NOT NULL DEFAULT TRUE,
  -- Stored as decimal fraction: 0.5 = 50%, 1.0 = 100%. NULL = inherits from store_settings
  max_discount_percent DECIMAL(8,6),

  -- Replenishment hints
  reorder_point DECIMAL(19,4),
  reorder_quantity DECIMAL(19,4),

  sort_order INT, -- sort using ASC NULLS LAST to keep nulls at the end.
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Extensibility
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT chk_product_variants_attributes_object
    CHECK (jsonb_typeof(attributes) = 'object'),
  CONSTRAINT chk_product_variants_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT chk_product_variants_prices_nonnegative
    CHECK (
      selling_price >= 0
      AND (cost_price IS NULL OR cost_price >= 0)
      AND (min_selling_price IS NULL OR min_selling_price >= 0)
    ),
  CONSTRAINT chk_product_variants_discount_rate_valid
    CHECK (
      max_discount_percent IS NULL
      OR (max_discount_percent >= 0 AND max_discount_percent <= 1)
    ),
  CONSTRAINT chk_product_variants_unit_precision_valid
    CHECK (unit_precision >= 0 AND unit_precision <= 6),
  CONSTRAINT chk_product_variants_reorder_nonnegative
    CHECK (
      (reorder_point IS NULL OR reorder_point >= 0)
      AND (reorder_quantity IS NULL OR reorder_quantity >= 0)
    )
);

-- Indexes
CREATE INDEX idx_product_variants_store_product
  ON operational.product_variants (store_id, product_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX ux_product_variants_store_sku_active
  ON operational.product_variants (store_id, sku)
  WHERE deleted_at IS NULL AND sku IS NOT NULL;

CREATE UNIQUE INDEX ux_product_variants_store_barcode_active
  ON operational.product_variants (store_id, barcode)
  WHERE deleted_at IS NULL AND barcode IS NOT NULL;

CREATE INDEX idx_product_variants_barcode_registry
  ON operational.product_variants (barcode_registry_id)
  WHERE deleted_at IS NULL AND barcode_registry_id IS NOT NULL;

CREATE INDEX idx_product_variants_store_active
  ON operational.product_variants (store_id, is_active, sort_order ASC NULLS LAST)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_product_variants_store_display_name_active
  ON operational.product_variants (store_id, normalized_display_name)
  WHERE deleted_at IS NULL;

-- Triggers
CREATE TRIGGER trg_set_product_variants_updated_at
BEFORE UPDATE ON operational.product_variants
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS: (tenant-scoped)
ALTER TABLE operational.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.product_variants FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_product_variants ON operational.product_variants
  USING (store_id = current_setting('app.current_store_id', true)::UUID);
  
CREATE POLICY tenant_isolation_product_variants_ins ON operational.product_variants
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
DROP TABLE IF EXISTS operational.product_variants;
      `,
    )
    .execute(db);
}
