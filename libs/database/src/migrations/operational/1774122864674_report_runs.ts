import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Tracks each time a report is generated (for auditability + download history).
-- output points to your object storage (S3/Cloudinary/etc.) via metadata; no binary stored in DB.

CREATE TYPE operational.report_run_status AS ENUM (
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled'
);

CREATE TYPE operational.report_output_format AS ENUM ('csv', 'xlsx', 'pdf', 'json');

CREATE TABLE operational.report_runs (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  created_by_store_member_id UUID REFERENCES operational.store_members(id) ON DELETE SET NULL,
  report_definition_id UUID REFERENCES operational.report_definitions(id) ON DELETE SET NULL,
  -- Output stored as a media_asset. NULL until report completes.
  -- Access URL, size, checksum etc. available via media_assets join.
  output_media_id UUID REFERENCES operational.media_assets(id) ON DELETE SET NULL,

  report_key TEXT NOT NULL,
  scope operational.report_scope NOT NULL DEFAULT 'operational',
  status operational.report_run_status NOT NULL DEFAULT 'queued',

  parameters_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb, -- the exact params used for this run
  output_format operational.report_output_format NOT NULL DEFAULT 'csv',

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_report_runs_params_object
    CHECK (jsonb_typeof(parameters_snapshot) = 'object'),
  CONSTRAINT chk_report_runs_status_timestamps
    CHECK (
      (status = 'queued' AND started_at IS NULL AND completed_at IS NULL)
      OR (status = 'running' AND started_at IS NOT NULL AND completed_at IS NULL)
      OR (status = 'completed' AND started_at IS NOT NULL AND completed_at IS NOT NULL)
      OR (status = 'failed' AND started_at IS NOT NULL AND completed_at IS NULL)
      OR (status = 'cancelled')
    )
);

-- Indexes
CREATE INDEX idx_report_runs_store_time
  ON operational.report_runs (store_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_report_runs_store_status_time
  ON operational.report_runs (store_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_report_runs_store_report_key_time
  ON operational.report_runs (store_id, report_key, created_at DESC)
  WHERE deleted_at IS NULL;

-- Triggers
CREATE TRIGGER trg_set_report_runs_updated_at
BEFORE UPDATE ON operational.report_runs
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS: (tenant-scoped)
ALTER TABLE operational.report_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.report_runs FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_report_runs ON operational.report_runs
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_report_runs_ins ON operational.report_runs
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
DROP TABLE IF EXISTS operational.report_runs;
DROP TYPE IF EXISTS operational.report_run_status;
DROP TYPE IF EXISTS operational.report_output_format;
      `,
    )
    .execute(db);
}
