import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Product lifecycle state
CREATE TYPE operational.product_status AS ENUM ('active', 'inactive', 'archived');

-- Product type (bundle removed; factory bundles are just physical products)
CREATE TYPE operational.product_type AS ENUM ('physical', 'service', 'digital');

-- How quantity is measured/sold
CREATE TYPE operational.quantity_mode AS ENUM ('unit', 'weight', 'volume', 'length');

-- Store-owned products (single source of truth for inventory and POS)

CREATE TABLE operational.products (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  created_by_store_member_id UUID REFERENCES operational.store_members(id) ON DELETE SET NULL,
  tax_class_id UUID REFERENCES operational.tax_classes(id) ON DELETE SET NULL,
  category_id UUID REFERENCES operational.store_categories(id) ON DELETE SET NULL,
  base_uom_id UUID REFERENCES operational.store_uoms(id) ON DELETE SET NULL,

  status operational.product_status NOT NULL DEFAULT 'active',
  product_type operational.product_type NOT NULL DEFAULT 'physical',
  quantity_mode operational.quantity_mode NOT NULL DEFAULT 'unit',

  -- Identity
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  description TEXT,

  brand_name TEXT,
  normalized_brand_name TEXT,

  has_variants BOOLEAN NOT NULL DEFAULT FALSE, -- whether this product has variants (e.g., different sizes/colors); purely informational, doesn't affect behavior
  
  -- Traceability / perishables
  -- Soft default to FALSE for services and digital products enforced via application logic
  -- Not a hard constraint since some services might still want inventory tracking (e.g., rentals, appointments)
  track_inventory BOOLEAN NOT NULL DEFAULT TRUE,
  is_perishable BOOLEAN NOT NULL DEFAULT FALSE,
  shelf_life_days INT,
  requires_lot_tracking BOOLEAN NOT NULL DEFAULT FALSE,
  requires_serial_tracking BOOLEAN NOT NULL DEFAULT FALSE,

  -- Weight/dimensions for shipping (physical products)
  weight_grams DECIMAL(10,3),
  length_mm DECIMAL(10,3),
  width_mm DECIMAL(10,3),
  height_mm DECIMAL(10,3),

  -- Extensibility
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Search
  search_vector TSVECTOR,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  -- Constraints

  CONSTRAINT chk_store_products_attributes_object
    CHECK (jsonb_typeof(attributes) = 'object'),
  CONSTRAINT chk_store_products_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT chk_store_products_shelf_life_nonnegative
    CHECK (shelf_life_days IS NULL OR shelf_life_days >= 0),
  CONSTRAINT chk_traceability_requires_inventory
    CHECK (
      track_inventory = TRUE
      OR (
        requires_lot_tracking = FALSE
        AND requires_serial_tracking = FALSE
      )
    )
);

-- Indexes
CREATE INDEX idx_products_store_id_id
  ON operational.products (store_id, id DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX ux_products_store_normalized_name_active
  ON operational.products (store_id, normalized_name)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_products_store_status
  ON operational.products (store_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_products_store_brand
  ON operational.products (store_id, normalized_brand_name)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_products_search_vector
  ON operational.products USING GIN (search_vector);

-- Triggers
CREATE TRIGGER trg_set_products_updated_at
BEFORE UPDATE ON operational.products
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

CREATE OR REPLACE FUNCTION operational.set_product_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (
    NEW.name IS DISTINCT FROM OLD.name OR
    NEW.description IS DISTINCT FROM OLD.description OR
    NEW.brand_name IS DISTINCT FROM OLD.brand_name
  ) THEN
    NEW.search_vector :=
      to_tsvector(
        'simple',
        coalesce(NEW.name, '') || ' ' ||
        coalesce(NEW.description, '') || ' ' ||
        coalesce(NEW.brand_name, '')
      );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_search_vector
BEFORE INSERT OR UPDATE
ON operational.products
FOR EACH ROW
EXECUTE FUNCTION operational.set_product_search_vector();

-- RLS: (tenant-scoped)
ALTER TABLE operational.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.products FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_products ON operational.products
  USING (store_id = current_setting('app.current_store_id', true)::UUID);
  
CREATE POLICY tenant_isolation_products_ins ON operational.products
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
DROP TABLE IF EXISTS operational.products;
DROP FUNCTION IF EXISTS operational.set_product_search_vector();
DROP TYPE IF EXISTS operational.product_status;
DROP TYPE IF EXISTS operational.product_type;
DROP TYPE IF EXISTS operational.quantity_mode;
      `,
    )
    .execute(db);
}
