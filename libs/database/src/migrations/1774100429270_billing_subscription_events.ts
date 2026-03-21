import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
CREATE TABLE operational.billing_subscription_events (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  business_id UUID NOT NULL REFERENCES operational.businesses(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES operational.billing_subscriptions(id) ON DELETE RESTRICT,
  actor_store_member_id UUID REFERENCES operational.store_members(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES operational.billing_invoices(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES operational.billing_payments(id) ON DELETE SET NULL,

  event_type TEXT NOT NULL,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Immutable audit log of subscription lifecycle events.
  -- No updates or deletes. Forward references only.

  CONSTRAINT chk_subscription_event_metadata
    CHECK (jsonb_typeof(metadata) = 'object')
);

-- Indexes
CREATE INDEX idx_billing_subscription_events_subscription
  ON operational.billing_subscription_events (subscription_id, created_at DESC);

CREATE INDEX idx_billing_subscription_events_business_time
  ON operational.billing_subscription_events (business_id, created_at DESC);

CREATE INDEX idx_billing_subscription_events_type_time
  ON operational.billing_subscription_events (event_type, created_at DESC);

-- Immutability enforced at application layer in SubscriptionService.
-- Never update or delete subscription events.
      `,
    )
    .execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
DROP TABLE IF EXISTS operational.billing_subscription_events;
      `,
    )
    .execute(db);
}
