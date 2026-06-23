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

  sku TEXT,
  barcode TEXT,

  -- Display name combines option values e.g. "Red / Large"
  -- Computed and stored for display performance, updated at app layer when options change
  display_name TEXT NOT NULL,
  normalized_display_name TEXT NOT NULL,

  -- Measurement details
  unit_precision SMALLINT NOT NULL DEFAULT 0,
  pack_size TEXT,

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
  CONSTRAINT chk_product_variants_unit_precision_valid
    CHECK (unit_precision >= 0 AND unit_precision <= 6)
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
