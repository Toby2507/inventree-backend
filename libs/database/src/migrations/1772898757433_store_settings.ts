import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Store-wide settings and preferences.
-- One row per store (store_id is both PK and tenant key).
-- Keep "query-critical" settings as columns; keep low-stakes expansion as JSONB.

CREATE TYPE operational.stock_valuation_method AS ENUM ('fifo', 'lifo', 'weighted_average', 'standard_cost');

CREATE TABLE operational.store_settings (
  store_id UUID PRIMARY KEY REFERENCES operational.stores(id),

  -- Locale preferences
  locale TEXT NOT NULL DEFAULT 'en',
  timezone TEXT NOT NULL DEFAULT 'Africa/Lagos',

  -- Money display settings (values stored as DECIMAL(19,4) everywhere)
  currency CHAR(3) NOT NULL DEFAULT 'NGN',
  currency_symbol TEXT DEFAULT '₦',
  money_scale SMALLINT NOT NULL DEFAULT 2,

  -- Rounding rules
  round_cash_totals BOOLEAN NOT NULL DEFAULT FALSE,
  cash_rounding_increment DECIMAL(19,4),

  -- Inventory rules
  allow_negative_inventory BOOLEAN NOT NULL DEFAULT FALSE,
  -- Default costing method; individual products can override.
  -- Defaults to weighted_average — most universally accepted under IFRS.
  stock_valuation_method operational.stock_valuation_method NOT NULL DEFAULT 'weighted_average',
  low_stock_threshold INT NOT NULL DEFAULT 10,
  auto_reorder_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- POS rules
  require_manager_for_refunds BOOLEAN NOT NULL DEFAULT TRUE,
  require_manager_for_price_override BOOLEAN NOT NULL DEFAULT TRUE,
  allow_discount BOOLEAN NOT NULL DEFAULT TRUE,
  -- Stored as decimal fraction: 0.5 = 50%, 1.0 = 100%
  max_discount_percent DECIMAL(8,6) NOT NULL DEFAULT 1.0,

  settings_extra JSONB NOT NULL DEFAULT '{}'::jsonb, -- expansion bucket (keep object)

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,

  CONSTRAINT chk_settings_extra_object
    CHECK (jsonb_typeof(settings_extra) = 'object'),
  CONSTRAINT chk_cash_rounding_consistency
    CHECK (
      (round_cash_totals = FALSE AND cash_rounding_increment IS NULL)
      OR
      (round_cash_totals = TRUE  AND cash_rounding_increment IS NOT NULL AND cash_rounding_increment > 0)
    ),
  CONSTRAINT chk_max_discount_percent_range
    CHECK (max_discount_percent >= 0 AND max_discount_percent <= 1)
);

CREATE TRIGGER trg_set_store_settings_updated_at
BEFORE UPDATE ON operational.store_settings
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS (tenant-scoped)
ALTER TABLE operational.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.store_settings FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_store_settings ON operational.store_settings
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_store_settings_ins ON operational.store_settings
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
DROP TABLE IF EXISTS operational.store_settings;
DROP TYPE IF EXISTS operational.stock_valuation_method;
      `,
    )
    .execute(db);
}
