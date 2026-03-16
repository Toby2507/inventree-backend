import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Store-scoped reason catalog for adjustments/write-offs.
-- This enables clean reporting and analytics (shrinkage, damage, expiry, etc.)
-- while still allowing ad-hoc reasons via metadata if needed.

CREATE TYPE operational.inventory_adjustment_reason_category AS ENUM (
  'correction',   -- fixing a mistake
  'damage',       -- damaged goods
  'expiry',       -- expired/spoiled
  'shrinkage',    -- theft/loss
  'internal_use', -- staff use / store use
  'other'
);

CREATE TABLE operational.inventory_adjustment_reasons (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,

  code TEXT NOT NULL, -- short stable code, e.g. "DAMAGED", "SHRINK"
  name TEXT NOT NULL, -- display label
  normalized_name TEXT NOT NULL, -- app-normalized for dedupe/search
  category operational.inventory_adjustment_reason_category NOT NULL DEFAULT 'other',

  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_inventory_adjustment_reasons_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object')
);

-- Indexes
CREATE INDEX idx_adj_reasons_store_id_id
  ON operational.inventory_adjustment_reasons (store_id, id DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX ux_adj_reasons_store_code_active
  ON operational.inventory_adjustment_reasons (store_id, code)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX ux_adj_reasons_store_normalized_name_active
  ON operational.inventory_adjustment_reasons (store_id, normalized_name)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_adj_reasons_store_category
  ON operational.inventory_adjustment_reasons (store_id, category)
  WHERE deleted_at IS NULL;

-- Triggers
CREATE TRIGGER trg_set_inventory_adjustment_reasons_updated_at
BEFORE UPDATE ON operational.inventory_adjustment_reasons
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS
ALTER TABLE operational.inventory_adjustment_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.inventory_adjustment_reasons FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_adj_reasons ON operational.inventory_adjustment_reasons
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_adj_reasons_ins ON operational.inventory_adjustment_reasons
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
DROP TABLE IF EXISTS operational.inventory_adjustment_reasons;
DROP TYPE IF EXISTS operational.inventory_adjustment_reason_category;
      `,
    )
    .execute(db);
}
