import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
CREATE TYPE operational.tax_scope AS ENUM (
  'line_item', -- tax applies per POS line item (product-level)
  'order',      -- tax applies on order/transaction subtotal (bill-level levy)
  'shipping'   -- tax applies on shipping charges (if applicable)
);

CREATE TABLE operational.tax_rates (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,

  name TEXT NOT NULL, -- display name e.g. "VAT Standard", "NHIL", "Service Levy"
  normalized_name TEXT NOT NULL, -- app-normalized for dedupe/search
  code TEXT NOT NULL, -- stable code e.g. "VAT_STD", "NHIL", "SRV_LVY"; unique per store

  scope operational.tax_scope NOT NULL DEFAULT 'line_item', -- where this tax definition is intended to apply
  rate DECIMAL(8,6) NOT NULL, -- decimal fraction e.g. 0.075000 for 7.5%, 0.000000 for exempt/zero-rated
  country_code CHAR(2), -- ISO country code for reference/validation (optional)

  is_active BOOLEAN NOT NULL DEFAULT TRUE, -- enable/disable without deleting (preserves historical configs)
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- creation timestamp (UTC)
  updated_at TIMESTAMPTZ, -- updated when mutable fields change
  deleted_at TIMESTAMPTZ, -- soft delete for retention

  CONSTRAINT chk_tax_rates_rate_bounds
    CHECK (rate >= 0 AND rate <= 1),
  CONSTRAINT chk_tax_rates_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object')
);

-- Indexes
CREATE UNIQUE INDEX ux_tax_rates_store_code
  ON operational.tax_rates (store_id, code)
  WHERE deleted_at IS NULL; -- stable uniqueness per store

CREATE UNIQUE INDEX ux_tax_rates_store_name
  ON operational.tax_rates (store_id, normalized_name)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_tax_rates_store_scope_active
  ON operational.tax_rates (store_id, scope, is_active)
  WHERE deleted_at IS NULL;

-- Triggers
CREATE TRIGGER trg_tax_rates_set_updated_at
BEFORE UPDATE ON operational.tax_rates
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS: (tenant-scoped)
ALTER TABLE operational.tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.tax_rates FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_tax_rates ON operational.tax_rates
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_tax_rates_ins ON operational.tax_rates
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
DROP TABLE IF EXISTS operational.tax_rates;
DROP TYPE IF EXISTS operational.tax_scope;
      `,
    )
    .execute(db);
}
