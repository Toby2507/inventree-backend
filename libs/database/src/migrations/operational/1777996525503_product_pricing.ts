import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Pricing information for product variants
-- Conforms to SCD (Slowly Changing Dimension) Type 2 pattern for historical price tracking ("Time Travel" queries)

CREATE TABLE operational.product_variant_prices (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  product_variant_id UUID NOT NULL REFERENCES operational.product_variants(id) ON DELETE CASCADE,

  selling_price DECIMAL(19,4) NOT NULL,
  min_selling_price DECIMAL(19,4),

  -- Discount behaviour
  allow_discount BOOLEAN NOT NULL DEFAULT TRUE,
  max_discount_percent DECIMAL(8,6),

  -- The "Time Travel" columns
  valid_from TIMESTAMPTZ NOT NULL,
  valid_to TIMESTAMPTZ, -- NULL means "Current Price"

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT chk_product_variants_prices_nonnegative
    CHECK (
      selling_price >= 0
      AND (min_selling_price IS NULL OR min_selling_price >= 0)
    ),
  CONSTRAINT chk_product_variants_discount_rate_valid
    CHECK (
      max_discount_percent IS NULL
      OR (max_discount_percent >= 0 AND max_discount_percent <= 1)
    ),
  CONSTRAINT chk_product_variant_prices_validity_range
    CHECK (valid_to IS NULL OR valid_from < valid_to),
  CONSTRAINT no_overlapping_price_ranges
    EXCLUDE USING gist (
      product_variant_id WITH =,
      tstzrange(valid_from, COALESCE(valid_to, 'infinity')) WITH &&
    )
);

-- Indexes
CREATE UNIQUE INDEX ux_product_variant_single_active_price
  ON operational.product_variant_prices (store_id, product_variant_id)
  WHERE valid_to IS NULL;

-- Functions
CREATE OR REPLACE FUNCTION close_previous_product_variant_price()
RETURNS TRIGGER AS $$
BEGIN
  -- Lock the current active price row
  PERFORM 1
  FROM operational.product_variant_prices
  WHERE product_variant_id = NEW.product_variant_id
    AND store_id = NEW.store_id
    AND valid_to IS NULL
  FOR UPDATE;

  -- Close it
  UPDATE operational.product_variant_prices
  SET valid_to = NEW.valid_from
  WHERE product_variant_id = NEW.product_variant_id
    AND store_id = NEW.store_id
    AND valid_to IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER trg_set_product_variant_prices_updated_at
BEFORE UPDATE ON operational.product_variant_prices
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

CREATE TRIGGER trg_close_previous_product_variant_price
BEFORE INSERT ON operational.product_variant_prices
FOR EACH ROW
EXECUTE FUNCTION close_previous_product_variant_price();

-- RLS: (tenant-scoped)
ALTER TABLE operational.product_variant_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.product_variant_prices FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_product_variant_prices ON operational.product_variant_prices
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_product_variant_prices_ins ON operational.product_variant_prices
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
DROP FUNCTION IF EXISTS close_previous_product_variant_price;
DROP TABLE operational.product_variant_prices;
      `,
    )
    .execute(db);
}
