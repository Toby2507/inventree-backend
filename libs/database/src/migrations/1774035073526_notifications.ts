import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
CREATE TYPE operational.notification_channel AS ENUM ('in_app','email');
CREATE TYPE operational.notification_status AS ENUM (
  'queued',       -- created but not fanned-out / delivered yet
  'fanned_out',   -- receipts created for audience
  'sent',         -- at least one delivery succeeded (or for in_app: receipts created)
  'failed',
  'cancelled'
);
CREATE TYPE operational.notification_audience_type AS ENUM (
  'member', -- single member
  'role',         -- role(s)
  'store',    -- everyone in store
  'member_list' -- explicit set of store_member_ids
);

CREATE TABLE operational.notifications (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  created_by_store_member_id UUID REFERENCES operational.store_members(id) ON DELETE SET NULL,
  recipient_store_member_id UUID REFERENCES operational.store_members(id) ON DELETE SET NULL, -- populated when audience_type = 'member'

  event_type TEXT NOT NULL, -- keep as TEXT (extensible), e.g. 'inventory.low_stock'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  action_url TEXT,

  audience_type operational.notification_audience_type NOT NULL DEFAULT 'member',
  channels operational.notification_channel[] NOT NULL DEFAULT ARRAY['in_app']::operational.notification_channel[],

  source_type TEXT,   -- e.g., 'inventory_item', 'purchase_order', 'pos_transaction'
  source_id UUID,     -- id from that entity (no FK — cross-context loose coupling)

  recipient_roles TEXT[], -- populated when audience_type = 'role',
  recipient_member_ids UUID[], -- populated when audience_type = 'member_list'

  payload JSONB NOT NULL DEFAULT '{}'::jsonb, -- denormalized render context

  status operational.notification_status NOT NULL DEFAULT 'queued',
  fanned_out_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_notifications_payload_object
    CHECK (jsonb_typeof(payload) = 'object'),
  -- Ensure audience fields match type
  CONSTRAINT chk_notifications_audience_fields
    CHECK (
      (audience_type = 'member' AND recipient_store_member_id IS NOT NULL)
      OR (audience_type = 'role' AND recipient_roles IS NOT NULL AND cardinality(recipient_roles) > 0)
      OR (audience_type = 'store')
      OR (audience_type = 'member_list' AND recipient_member_ids IS NOT NULL)
    )
);

-- Indexes
CREATE INDEX idx_notifications_store_time
  ON operational.notifications (store_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_notifications_store_status_time
  ON operational.notifications (store_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_notifications_store_event_time
  ON operational.notifications (store_id, event_type, created_at DESC)
  WHERE deleted_at IS NULL;

-- Triggers
CREATE TRIGGER trg_set_notifications_updated_at
BEFORE UPDATE ON operational.notifications
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS: (tenant-scoped)
ALTER TABLE operational.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.notifications FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_notifications ON operational.notifications
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_notifications_ins ON operational.notifications
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
DROP TABLE IF EXISTS operational.notifications;
DROP TYPE IF EXISTS operational.notification_channel;
DROP TYPE IF EXISTS operational.notification_status;
DROP TYPE IF EXISTS operational.notification_audience_type;
      `,
    )
    .execute(db);
}
