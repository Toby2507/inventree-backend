import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Groups related store products that are variants of the same "family".
-- Example: "Color" group containing Black, Red, White options.
-- Example: "Size" group containing 35cl, 50cl, 1L options.

CREATE TABLE operational.store_variant_groups (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  description TEXT,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_variant_groups_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object')
);

-- Indexes
CREATE INDEX idx_variant_groups_store_id_id
  ON operational.store_variant_groups (store_id, id DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX ux_variant_groups_store_normalized_name_active
  ON operational.store_variant_groups (store_id, normalized_name)
  WHERE deleted_at IS NULL;

-- Triggers
CREATE TRIGGER trg_set_variant_groups_updated_at
BEFORE UPDATE ON operational.store_variant_groups
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS: (tenant-scoped)
ALTER TABLE operational.store_variant_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.store_variant_groups FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_variant_groups ON operational.store_variant_groups
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_variant_groups_ins ON operational.store_variant_groups
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
DROP TABLE IF EXISTS operational.store_variant_groups;
      `,
    )
    .execute(db);
}
