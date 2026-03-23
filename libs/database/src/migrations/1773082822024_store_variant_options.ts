import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Options for product variants, grouped by "family" (variant group).
-- Example: "Color" group containing Black, Red, White options.
-- Example: "Size" group containing 35cl, 50cl, 1L options.

CREATE TABLE operational.store_variant_options (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  -- Hard delete of group blocked by RESTRICT.
  -- Soft-deleting a group with active options must be prevented at application layer.
  store_variant_group_id UUID NOT NULL REFERENCES operational.store_variant_groups(id) ON DELETE RESTRICT,

  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  description TEXT,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_variant_options_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object')
);

-- Indexes
CREATE INDEX idx_variant_options_store_id_id
  ON operational.store_variant_options (store_id, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_variant_options_store_group
  ON operational.store_variant_options (store_id, store_variant_group_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX ux_variant_options_group_normalized_name_active
  ON operational.store_variant_options (store_id, store_variant_group_id, normalized_name)
  WHERE deleted_at IS NULL;

-- Triggers
CREATE TRIGGER trg_set_variant_options_updated_at
BEFORE UPDATE ON operational.store_variant_options
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS: (tenant-scoped)
ALTER TABLE operational.store_variant_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.store_variant_options FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_variant_options ON operational.store_variant_options
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_variant_options_ins ON operational.store_variant_options
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
DROP TABLE IF EXISTS operational.store_variant_options;
      `,
    )
    .execute(db);
}
