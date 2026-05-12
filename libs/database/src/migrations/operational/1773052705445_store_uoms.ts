import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Store-local units of measure (UOMs).
-- Purpose: consistent UOMs for conversions, inventory, recipes, reporting, and staff UX.

CREATE TABLE operational.store_uoms (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,

  name TEXT NOT NULL,              -- e.g., "Pack", "Carton", "Kg"
  normalized_name TEXT NOT NULL,   -- e.g., "pack", "carton", "kg"
  symbol TEXT,                     -- e.g., "pk", "ctn", "kg" (optional)
  description TEXT,

  sort_order INT,  -- sort using ASC NULLS LAST to keep nulls at the end.
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_store_uoms_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object')
);

-- Indexes
CREATE INDEX idx_store_uoms_store_created
  ON operational.store_uoms (store_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX ux_store_uoms_store_normalized_name_active
  ON operational.store_uoms (store_id, normalized_name)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX ux_store_uoms_store_symbol_active
  ON operational.store_uoms (store_id, symbol)
  WHERE deleted_at IS NULL AND symbol IS NOT NULL;

CREATE INDEX idx_store_uoms_store_active
  ON operational.store_uoms (store_id, sort_order ASC NULLS LAST)
  WHERE deleted_at IS NULL AND is_active = TRUE;

-- Triggers
CREATE TRIGGER trg_set_store_uoms_updated_at
BEFORE UPDATE ON operational.store_uoms
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS: (tenant-scoped)
ALTER TABLE operational.store_uoms ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.store_uoms FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_store_uoms ON operational.store_uoms
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_store_uoms_ins ON operational.store_uoms
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
DROP TABLE IF EXISTS operational.store_uoms;
      `,
    )
    .execute(db);
}
