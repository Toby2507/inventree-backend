import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Tax class → tax rate mapping for line-item taxes (ordered + explicit base rules).
-- This is where you model: "VAT on subtotal, then NHIL on subtotal+VAT" for specific products only.

-- What base amount a tax is computed on (enables real-world compounding/cascading).
CREATE TYPE operational.tax_base AS ENUM (
  'subtotal',                  -- base is the pre-tax subtotal for the scope
  'subtotal_plus_non_compound', -- base is subtotal + sum(non-compound taxes already applied in this scope)
  'subtotal_plus_all_prior'     -- base is subtotal + sum(all taxes already applied earlier in this scope)
);

CREATE TABLE operational.tax_class_rates (
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  tax_class_id UUID NOT NULL REFERENCES operational.tax_classes(id) ON DELETE RESTRICT,
  tax_rate_id UUID NOT NULL REFERENCES operational.tax_rates(id) ON DELETE RESTRICT,

  sort_order INT,  -- sort using ASC NULLS LAST to keep nulls at the end.
  base operational.tax_base NOT NULL DEFAULT 'subtotal',

  effective_from DATE, -- inclusive start date when this rate becomes valid; NULL = no lower bound
  effective_to DATE, -- exclusive end date when this rate stops being valid; NULL = open-ended

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  PRIMARY KEY (store_id, tax_class_id, tax_rate_id),

  CONSTRAINT chk_tax_class_rates_effective_range
    CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to > effective_from)
);

-- Indexes
CREATE INDEX idx_tax_class_rates_store_class_order
  ON operational.tax_class_rates (store_id, tax_class_id, sort_order ASC NULLS LAST, tax_rate_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_tax_class_rates_store_rate
  ON operational.tax_class_rates (store_id, tax_rate_id)
  WHERE deleted_at IS NULL; -- reverse lookup (classes that use a rate)

-- Triggers
CREATE TRIGGER trg_set_tax_class_rates_updated_at
BEFORE UPDATE ON operational.tax_class_rates
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS: (tenant-scoped)
ALTER TABLE operational.tax_class_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.tax_class_rates FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_tax_class_rates ON operational.tax_class_rates
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_tax_class_rates_ins ON operational.tax_class_rates
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
DROP TABLE IF EXISTS operational.tax_class_rates;
DROP TYPE IF EXISTS operational.tax_base;
      `,
    )
    .execute(db);
}
