import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Product-specific alternate units and conversions.
-- Mental model:
-- - products.base_uom_id is the inventory truth unit (optional per product).
-- - This table defines other units (e.g., carton, crate, bag) and how they convert to base.
-- - One row per (product, uom). No duplicates.
-- - usage controls where the unit is allowed: sale / purchase / both.

CREATE TYPE operational.product_uom_usage AS ENUM ('sale', 'purchase', 'both');

CREATE TABLE operational.product_uoms (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  created_by_store_member_id UUID REFERENCES operational.store_members(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES operational.products(id) ON DELETE CASCADE,
  uom_id UUID NOT NULL REFERENCES operational.store_uoms(id) ON DELETE RESTRICT,

  usage operational.product_uom_usage NOT NULL DEFAULT 'both',

  -- 1 of this uom equals X base units for this product.
  -- Example: base=pack, carton conversion_to_base=40 means 1 carton = 40 packs.
  conversion_to_base NUMERIC(19,6) NOT NULL,

  is_default_for_sales BOOLEAN NOT NULL DEFAULT FALSE,
  is_default_for_purchase BOOLEAN NOT NULL DEFAULT FALSE,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_store_product_uoms_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT chk_store_product_uoms_conversion_positive
    CHECK (conversion_to_base > 0),
  -- Prevent selecting a default that isn't allowed by usage
  CONSTRAINT chk_store_product_uoms_default_sales_usage
    CHECK (is_default_for_sales = FALSE OR usage IN ('sale', 'both')),
  CONSTRAINT chk_store_product_uoms_default_purchase_usage
    CHECK (is_default_for_purchase = FALSE OR usage IN ('purchase', 'both'))
);

-- Indexes
CREATE INDEX idx_product_uoms_store_id_id
  ON operational.product_uoms (store_id, id DESC)
  WHERE deleted_at IS NULL;

-- One row per product per uom (active)
CREATE UNIQUE INDEX ux_product_uoms_product_uom_active
  ON operational.product_uoms (product_id, uom_id)
  WHERE deleted_at IS NULL;

-- Defaults per product (active) - optional (product can have none)
CREATE UNIQUE INDEX ux_product_uoms_default_sales_active
  ON operational.product_uoms (product_id)
  WHERE deleted_at IS NULL AND is_default_for_sales = TRUE;

CREATE UNIQUE INDEX ux_product_uoms_default_purchase_active
  ON operational.product_uoms (product_id)
  WHERE deleted_at IS NULL AND is_default_for_purchase = TRUE;

-- Useful for quick lookups during POS/purchasing
CREATE INDEX idx_product_uoms_store_uom
  ON operational.product_uoms (store_id, uom_id)
  WHERE deleted_at IS NULL;

-- Triggers
CREATE TRIGGER trg_set_product_uoms_updated_at
BEFORE UPDATE ON operational.product_uoms
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS (tenant-scoped)
ALTER TABLE operational.product_uoms ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.product_uoms FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_product_uoms_select ON operational.product_uoms
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_product_uoms_ins ON operational.product_uoms
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
DROP TABLE IF EXISTS operational.product_uoms;
DROP TYPE IF EXISTS operational.product_uom_usage;
      `,
    )
    .execute(db);
}
