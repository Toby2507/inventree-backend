import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Store-defined tax classes (products reference a class; NULL class => no tax applies).

CREATE TABLE operational.tax_classes (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,

  name TEXT NOT NULL, -- display name e.g. "Standard", "Medicines", "Food"
  normalized_name TEXT NOT NULL, -- app-normalized for dedupe/search
  code TEXT NOT NULL, -- stable code e.g. "STD", "MED", "FOOD"; unique per store
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_tax_classes_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object') -- ensure JSON object
);

-- Indexes
CREATE UNIQUE INDEX ux_tax_classes_store_code
  ON operational.tax_classes (store_id, code)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX ux_tax_classes_store_normalized_name
  ON operational.tax_classes (store_id, normalized_name)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_tax_classes_store_active
  ON operational.tax_classes (store_id, is_active, name)
  WHERE deleted_at IS NULL;

-- Triggers
CREATE TRIGGER trg_set_tax_classes_updated_at
BEFORE UPDATE ON operational.tax_classes
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS: (tenant-scoped)
ALTER TABLE operational.tax_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.tax_classes FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_tax_classes ON operational.tax_classes
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_tax_classes_ins ON operational.tax_classes
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
DROP TABLE IF EXISTS operational.tax_classes;
      `,
    )
    .execute(db);
}
