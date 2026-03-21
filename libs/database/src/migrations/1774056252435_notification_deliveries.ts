import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
CREATE TYPE operational.notification_delivery_status AS ENUM ('pending', 'sent', 'failed', 'bounced');

CREATE TABLE operational.notification_deliveries (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  notification_id UUID NOT NULL REFERENCES operational.notifications(id) ON DELETE RESTRICT,
  store_member_id UUID NOT NULL REFERENCES operational.store_members(id) ON DELETE RESTRICT,

  channel operational.notification_channel NOT NULL DEFAULT 'email',
  destination TEXT,

  status operational.notification_delivery_status NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ,

  sent_at TIMESTAMPTZ,
  provider_name TEXT,
  provider_ref TEXT,
  last_error TEXT,
  last_error_at TIMESTAMPTZ,

  payload JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_notification_deliveries_payload_object
    CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT chk_notification_deliveries_attempts_nonneg
    CHECK (attempts >= 0)
);

-- Indexes
CREATE INDEX idx_notification_deliveries_store_member
  ON operational.notification_deliveries (store_id, store_member_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_notification_deliveries_store_status_next
  ON operational.notification_deliveries (store_id, status, next_attempt_at, id)
  WHERE deleted_at IS NULL AND status IN ('pending', 'failed') AND next_attempt_at IS NOT NULL;

-- Triggers
CREATE TRIGGER trg_set_notification_deliveries_updated_at
BEFORE UPDATE ON operational.notification_deliveries
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS: (tenant-scoped)
ALTER TABLE operational.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.notification_deliveries FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_notification_deliveries ON operational.notification_deliveries
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_notification_deliveries_ins ON operational.notification_deliveries
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
DROP TABLE IF EXISTS operational.notification_deliveries;
DROP TYPE IF EXISTS operational.notification_delivery_status;
      `,
    )
    .execute(db);
}
