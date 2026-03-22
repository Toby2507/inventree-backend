import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Denormalized sales fact table at line-item grain.
-- Fed from 'pos.transaction.completed' events (and retractions from void/refund flows).
-- Partitioned by sold_at (monthly).

-- Generic processing state (useful for debugging pipelines)
CREATE TYPE analytics.row_ingest_status AS ENUM (
  'active',
  'retracted' -- e.g. voided/cancelled upstream
);

CREATE TABLE analytics.fact_sales (
  id UUID NOT NULL DEFAULT uuidv7(),  -- analytics-side id (not required to equal outbox id)

  -- Idempotency / lineage
  event_id UUID NOT NULL,                -- outbox_events.id (dedupe key)
  event_type TEXT NOT NULL,              -- e.g. 'pos.transaction.completed'
  event_occurred_at TIMESTAMPTZ NOT NULL, -- from outbox occurred_at

  -- Tenant identity
  store_id UUID NOT NULL,
  business_id UUID,                      -- optional if you want rollups by business later

  -- POS lineage
  pos_transaction_id UUID NOT NULL,
  pos_line_item_id UUID NOT NULL,
  pos_session_id UUID,
  terminal_id UUID,
  attendant_store_member_id UUID,

  -- Product snapshot
  store_product_id UUID NOT NULL,
  -- Reserved for future product clustering/grouping feature (FindIt intelligence).
  -- NULL until clustering pipeline is implemented.
  product_cluster_id UUID,
  sku TEXT,
  barcode TEXT,
  product_name TEXT NOT NULL,
  category_id UUID,
  category_label TEXT,

  -- Quantity & pricing snapshots
  quantity DECIMAL(19,6) NOT NULL,
  unit_price DECIMAL(19,4) NOT NULL,
  line_subtotal DECIMAL(19,4) NOT NULL,        -- quantity * unit_price (materialized for speed)
  line_discount_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  line_tax_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  line_total DECIMAL(19,4) NOT NULL,           -- subtotal - discount + tax (materialized)

  -- Cost snapshot for margin analytics (from store_products cost fields at sale time)
  unit_cost DECIMAL(19,4),
  line_cost_total DECIMAL(19,4),               -- quantity * unit_cost (optional materialized)

  -- Payment snapshot (denormalized; can be derived but kept for speed)
  payment_method TEXT,                         -- e.g. cash/bank_transfer/card/mixed
  currency_code CHAR(3) NOT NULL,              -- store currency at time of sale

  -- Geographic dimensions (optional; can be used for location-level reporting)
  store_country_code CHAR(2),
  store_city TEXT,
  store_state TEXT,
  store_local_area TEXT,
  store_geo_location GEOGRAPHY(POINT,4326), -- optional geospatial point for advanced geog queries
  
  -- Time dimensions
  sold_at TIMESTAMPTZ NOT NULL,                -- transaction completion time
  sold_date DATE NOT NULL,
  sold_hour SMALLINT NOT NULL,    -- 0-23
  sold_month SMALLINT NOT NULL,   -- 1-12
  sold_year SMALLINT NOT NULL,    -- e.g. 2026

  -- State for corrections (void/refund handling)
  ingest_status analytics.row_ingest_status NOT NULL DEFAULT 'active',
  retracted_at TIMESTAMPTZ,
  retraction_reason TEXT,

  -- Optional location context (if we want location-level sales)
  location_id UUID,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (id, sold_date),  -- include sold_date for partitioning performance

  CONSTRAINT chk_fact_sales_metadata_object CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT chk_fact_sales_qty_positive CHECK (quantity > 0),
  CONSTRAINT chk_fact_sales_hour
    CHECK (sold_hour BETWEEN 0 AND 23),
  CONSTRAINT chk_fact_sales_money_nonneg
    CHECK (
      unit_price >= 0 AND line_subtotal >= 0 AND line_total >= 0
      AND line_discount_amount >= 0 AND line_tax_amount >= 0
      AND (unit_cost IS NULL OR unit_cost >= 0)
      AND (line_cost_total IS NULL OR line_cost_total >= 0)
    ),
  CONSTRAINT chk_fact_sales_month
    CHECK (sold_month BETWEEN 1 AND 12),
  CONSTRAINT chk_fact_sales_year CHECK (sold_year >= 2020),
  CONSTRAINT chk_fact_sales_retraction_consistency
    CHECK (
      (ingest_status = 'active' AND retracted_at IS NULL AND retraction_reason IS NULL)
      OR (ingest_status = 'retracted' AND retracted_at IS NOT NULL)
    )
) PARTITION BY RANGE (sold_date);

-- Indexes
-- Idempotency: one fact row per unique upstream line-item event.
CREATE UNIQUE INDEX ux_fact_sales_event_line
  ON analytics.fact_sales (event_id, pos_line_item_id, sold_date);

-- Common query indexes (per partition recommended, but global indexes help planners too)
CREATE INDEX idx_fact_sales_store_date
  ON analytics.fact_sales (store_id, sold_date);

CREATE INDEX idx_fact_sales_store_product_date
  ON analytics.fact_sales (store_id, store_product_id, sold_date);

CREATE INDEX idx_fact_sales_store_category_date
  ON analytics.fact_sales (store_id, category_id, sold_date)
  WHERE category_id IS NOT NULL;

CREATE INDEX idx_fact_sales_tx
  ON analytics.fact_sales (store_id, pos_transaction_id, sold_at);

-- No RLS: analytics schema is read by worker-intelligence and analytics queries
-- which operate across all stores. Application layer enforces store_id filtering
-- when serving data to clients.

-- Partitions are created by worker-intelligence ahead of time.
-- Create next month's partition at the start of each month.
-- Naming convention: fact_sales_YYYY_MM
-- Example:
-- CREATE TABLE analytics.fact_sales_2026_03
--   PARTITION OF analytics.fact_sales
--   FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
--
-- Default partition recommended to catch rows with unexpected dates:
-- CREATE TABLE analytics.fact_sales_default
--   PARTITION OF analytics.fact_sales DEFAULT;
      `,
    )
    .execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
DROP TABLE IF EXISTS analytics.fact_sales;
DROP TYPE IF EXISTS analytics.row_ingest_status;
      `,
    )
    .execute(db);
}
