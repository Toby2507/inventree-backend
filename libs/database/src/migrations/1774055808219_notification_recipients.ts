import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
CREATE TABLE operational.notification_receipts (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  store_member_id UUID NOT NULL REFERENCES operational.store_members(id) ON DELETE CASCADE,
  notification_id UUID NOT NULL REFERENCES operational.notifications(id) ON DELETE RESTRICT,

  is_read BOOLEAN NOT NULL DEFAULT FALSE,

  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_notification_receipts_read_consistency
    CHECK (
      (is_read = FALSE AND read_at IS NULL)
      OR (is_read = TRUE AND read_at IS NOT NULL)
    )
);

-- Indexes
CREATE INDEX idx_notification_receipts_store_member_time
  ON operational.notification_receipts (store_id, store_member_id, delivered_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_notification_receipts_store_notification
  ON operational.notification_receipts (store_id, notification_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX ux_notification_receipts_notification_member
  ON operational.notification_receipts (notification_id, store_member_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_notification_receipts_store_member_unread
  ON operational.notification_receipts (store_id, store_member_id)
  WHERE deleted_at IS NULL AND is_read = FALSE;

-- RLS: (tenant-scoped)
ALTER TABLE operational.notification_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.notification_receipts FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_notification_receipts ON operational.notification_receipts
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_notification_receipts_ins ON operational.notification_receipts
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
DROP TABLE IF EXISTS operational.notification_receipts;
      `,
    )
    .execute(db);
}
