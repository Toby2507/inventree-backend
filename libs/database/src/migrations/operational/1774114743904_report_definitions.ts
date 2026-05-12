import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Saved report configurations for staff (filters, columns, grouping).
-- The actual data is queried live (operational) or pulled from analytics schema depending on report_type.

CREATE TYPE operational.report_scope AS ENUM ('operational', 'analytics');

CREATE TABLE operational.report_definitions (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  created_by_store_member_id UUID REFERENCES operational.store_members(id) ON DELETE SET NULL,

  name TEXT NOT NULL,                   -- "Daily Sales Summary", "Low Stock Report"
  description TEXT,

  scope operational.report_scope NOT NULL DEFAULT 'operational',

  -- used by the report worker to resolve which query/template to execute
  report_key TEXT NOT NULL, -- stable identifier for the report template e.g. 'sales_summary', 'low_stock'
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- When TRUE: visible to all active store members
  -- When FALSE: only visible to created_by_store_member_id
  -- Editing/deleting shared reports restricted to creator or administrator at application layer
  is_shared BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_report_definitions_params_object
    CHECK (jsonb_typeof(parameters) = 'object')
);

-- Indexes
CREATE INDEX idx_report_definitions_store_time
  ON operational.report_definitions (store_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_report_definitions_store_key
  ON operational.report_definitions (store_id, report_key)
  WHERE deleted_at IS NULL;

-- Triggers
CREATE TRIGGER trg_set_report_definitions_updated_at
BEFORE UPDATE ON operational.report_definitions
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS: (tenant-scoped)
ALTER TABLE operational.report_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.report_definitions FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_report_definitions ON operational.report_definitions
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_report_definitions_ins ON operational.report_definitions
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
DROP TABLE IF EXISTS operational.report_definitions;
DROP TYPE IF EXISTS operational.report_scope;
      `,
    )
    .execute(db);
}
