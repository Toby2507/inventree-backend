import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Store-enabled order-level taxes (bill-level levies like service levy).
-- This is required for "both" (line-item + order-level) tax flexibility.

CREATE TABLE operational.store_order_tax_rates (
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  -- NOTE: tax_rate_id must reference a tax_rate with scope = 'order'.
  -- Line-item scoped rates are applied via tax_class_rates, not here.
  -- Enforced at application layer in AddOrderTaxRateUseCase.
  tax_rate_id UUID NOT NULL REFERENCES operational.tax_rates(id) ON DELETE RESTRICT,

  sort_order INT,  -- sort using ASC NULLS LAST to keep nulls at the end.
  base operational.tax_base NOT NULL DEFAULT 'subtotal',

  effective_from DATE, -- inclusive start date when this rate becomes valid; NULL = no lower bound
  effective_to DATE, -- exclusive end date when this rate stops being valid; NULL = open-ended

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  PRIMARY KEY (store_id, tax_rate_id),

  CONSTRAINT chk_store_order_tax_rates_effective_range
    CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to > effective_from)
);

-- Indexes
CREATE INDEX idx_store_order_tax_rates_store_active_order
  ON operational.store_order_tax_rates (store_id, sort_order ASC NULLS LAST, tax_rate_id)
  WHERE deleted_at IS NULL; -- fetch enabled order-level taxes in order

-- Triggers
CREATE TRIGGER trg_set_store_order_tax_rates_updated_at
BEFORE UPDATE ON operational.store_order_tax_rates
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS: (tenant-scoped)
ALTER TABLE operational.store_order_tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.store_order_tax_rates FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_store_order_tax_rates ON operational.store_order_tax_rates
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_store_order_tax_rates_ins ON operational.store_order_tax_rates
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
DROP TABLE IF EXISTS operational.store_order_tax_rates;
      `,
    )
    .execute(db);
}
