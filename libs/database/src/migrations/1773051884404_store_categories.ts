import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Store-local categories (flat or hierarchical taxonomy).
-- Purpose: clean filtering, reporting, bulk operations, and consistent staff UX.

CREATE TABLE operational.store_categories (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  created_by_store_member_id UUID REFERENCES operational.store_members(id) ON DELETE SET NULL,
  -- Hard delete of parent blocked by RESTRICT.
  -- Soft-deleting a parent with active children must be prevented at application layer.
  parent_category_id UUID REFERENCES operational.store_categories(id) ON DELETE RESTRICT,

  name TEXT NOT NULL,                 -- display name e.g. "Drinks"
  normalized_name TEXT NOT NULL,      -- app-normalized for dedupe/search
  description TEXT,

  -- ltree path using dot-separated sanitized codes.
  -- e.g., "drinks.alcoholic.beer"
  -- normalized_name sanitized at app layer: hyphens -> underscores, spaces removed
  path LTREE NOT NULL,

  sort_order INT,  -- sort using ASC NULLS LAST to keep nulls at the end.
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_store_categories_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object')
);

-- Indexes
CREATE INDEX idx_store_categories_store_created
  ON operational.store_categories (store_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_store_categories_store_parent
  ON operational.store_categories (store_id, parent_category_id)
  WHERE deleted_at IS NULL AND parent_category_id IS NOT NULL;

CREATE UNIQUE INDEX ux_store_categories_store_normalized_name_active
  ON operational.store_categories (store_id, normalized_name)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_store_categories_store_active
  ON operational.store_categories (store_id, sort_order ASC NULLS LAST)
  WHERE deleted_at IS NULL AND is_active = TRUE;

-- Gist index required for ltree operators (@>, <@, ~, ?)
CREATE INDEX idx_store_categories_path
  ON operational.store_categories USING GIST (path)
  WHERE deleted_at IS NULL;

-- Triggers
CREATE TRIGGER trg_set_store_categories_updated_at
BEFORE UPDATE ON operational.store_categories
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS (tenant-scoped)
ALTER TABLE operational.store_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.store_categories FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_store_categories_select ON operational.store_categories
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_store_categories_ins ON operational.store_categories
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
DROP TABLE IF EXISTS operational.store_categories;
      `,
    )
    .execute(db);
}
