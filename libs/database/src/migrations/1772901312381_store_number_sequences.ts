import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Human-friendly numbering rules for operational documents.
-- This centralizes "next number" generation and format conventions.
-- Examples: transaction numbers, stock adjustments, purchase orders, transfers, etc.

CREATE TYPE operational.sequence_scope AS ENUM ('store'); -- future-proof if business-level sequences are ever needed
CREATE TYPE operational.sequence_reset_policy AS ENUM ('never', 'daily', 'monthly', 'yearly');

CREATE TABLE operational.store_number_sequences (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  sequence_key TEXT NOT NULL, -- e.g., 'transaction', 'stock_adjustment', 'inventory_transfer', 'purchase_order'
  scope operational.sequence_scope NOT NULL DEFAULT 'store',

  -- Sequence definition
  prefix TEXT,
  separator TEXT NOT NULL DEFAULT '-',
  padding SMALLINT NOT NULL DEFAULT 6,
  suffix TEXT,

  -- Optional: include date fragments in formatted number
  include_year  BOOLEAN NOT NULL DEFAULT FALSE,
  include_month BOOLEAN NOT NULL DEFAULT FALSE,
  include_day   BOOLEAN NOT NULL DEFAULT FALSE,


  -- current_value is incremented atomically via UPDATE...RETURNING at application layer.
  -- Never read then write in two separate statements — use atomic UPDATE SET current_value = current_value + 1 RETURNING current_value.
  current_value BIGINT NOT NULL DEFAULT 0,

  -- Reset policy
  reset_policy operational.sequence_reset_policy NOT NULL DEFAULT 'never',
  last_reset_at TIMESTAMPTZ,
  
  is_active BOOLEAN NOT NULL DEFAULT TRUE, -- allows soft-deactivation of specific sequences without deleting historical data

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,

  CONSTRAINT chk_padding_positive CHECK (padding > 0),
  CONSTRAINT chk_current_value_nonnegative CHECK (current_value >= 0),
  CONSTRAINT chk_reset_consistency
    CHECK (
      (reset_policy = 'never' AND last_reset_at IS NULL)
      OR
      reset_policy <> 'never'
    )
);

-- Uniqueness per store
CREATE UNIQUE INDEX ux_store_sequences_store_key_active
  ON operational.store_number_sequences (store_id, sequence_key)
  WHERE is_active = TRUE;

-- Tenant-leading indexes
CREATE INDEX idx_store_sequences_store
  ON operational.store_number_sequences (store_id)
  WHERE is_active = TRUE;

CREATE INDEX idx_store_sequences_reset_policy
  ON operational.store_number_sequences (store_id, reset_policy)
  WHERE is_active = TRUE;

CREATE TRIGGER trg_set_store_number_sequences_updated_at
BEFORE UPDATE ON operational.store_number_sequences
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS (tenant-scoped)
ALTER TABLE operational.store_number_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.store_number_sequences FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_store_number_sequences ON operational.store_number_sequences
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_store_number_sequences_ins ON operational.store_number_sequences
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
DROP TABLE IF EXISTS operational.store_number_sequences;
DROP TYPE IF EXISTS operational.sequence_scope;
DROP TYPE IF EXISTS operational.sequence_reset_policy;
      `,
    )
    .execute(db);
}
