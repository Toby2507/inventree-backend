import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Predefined discount catalog for a store.
-- Discounts can be applied at transaction or line level.
-- A discount can be a fixed amount or a percentage.

CREATE TYPE operational.discount_type AS ENUM (
  'percentage',   -- e.g., 10% off
  'fixed_amount'  -- e.g., ₦500 off
);

CREATE TYPE operational.discount_scope AS ENUM (
  'transaction',  -- applies to the whole transaction subtotal
  'line_item'     -- applies to a specific line item
);

CREATE TABLE operational.store_discounts (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  created_by_store_member_id UUID REFERENCES operational.store_members(id) ON DELETE SET NULL,
  code TEXT NOT NULL,             -- stable code e.g. "SAVE10", "STAFF50"
  name TEXT NOT NULL,             -- display name e.g. "10% Off", "Staff Discount"
  normalized_name TEXT NOT NULL,
  description TEXT,
  discount_type operational.discount_type NOT NULL,
  scope operational.discount_scope NOT NULL DEFAULT 'line_item',
  -- For percentage discounts: stored as decimal fraction e.g. 0.10 = 10%
  -- For fixed_amount discounts: stored in store currency
  value DECIMAL(19,4) NOT NULL,
  -- Optional validity window
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  -- Usage limits
  max_uses INT,                   -- NULL = unlimited
  uses_count INT NOT NULL DEFAULT 0, -- incremented atomically on use
  max_uses_per_transaction INT,   -- NULL = unlimited per transaction
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  -- Whether this discount requires manager approval to apply
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_store_discounts_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT chk_store_discounts_value_positive
    CHECK (value > 0),
  CONSTRAINT chk_store_discounts_percentage_range
    CHECK (
      discount_type <> 'percentage'
      OR (value > 0 AND value <= 1)
    ),
  CONSTRAINT chk_store_discounts_validity_range
    CHECK (
      valid_to IS NULL
      OR valid_from IS NULL
      OR valid_to > valid_from
    ),
  CONSTRAINT chk_store_discounts_uses_nonnegative
    CHECK (
      uses_count >= 0
      AND (max_uses IS NULL OR max_uses > 0)
      AND (max_uses_per_transaction IS NULL OR max_uses_per_transaction > 0)
    )
);

-- Indexes
CREATE UNIQUE INDEX ux_store_discounts_store_code_active
  ON operational.store_discounts (store_id, code)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX ux_store_discounts_store_normalized_name_active
  ON operational.store_discounts (store_id, normalized_name)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_store_discounts_store_active
  ON operational.store_discounts (store_id, is_active)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_store_discounts_store_scope
  ON operational.store_discounts (store_id, scope)
  WHERE deleted_at IS NULL AND is_active = TRUE;

CREATE INDEX idx_store_discounts_validity
  ON operational.store_discounts (store_id, valid_from, valid_to)
  WHERE deleted_at IS NULL AND is_active = TRUE;

-- Triggers
CREATE TRIGGER trg_set_store_discounts_updated_at
BEFORE UPDATE ON operational.store_discounts
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS: (tenant-scoped)
ALTER TABLE operational.store_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.store_discounts FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_store_discounts ON operational.store_discounts
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_store_discounts_ins ON operational.store_discounts
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
DROP TABLE IF EXISTS operational.store_discounts;
DROP TYPE IF EXISTS operational.discount_type;
DROP TYPE IF EXISTS operational.discount_scope;
      `,
    )
    .execute(db);
}
