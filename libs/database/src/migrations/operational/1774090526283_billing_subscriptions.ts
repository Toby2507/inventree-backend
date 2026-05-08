import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Subscription grants access/entitlements to a business and its stores.
-- One business typically has at most one active subscription at a time.

CREATE TYPE operational.subscription_status AS ENUM (
  'trialing',
  'active',
  'past_due',
  'paused',
  'cancelled',
  'expired'
);

CREATE TABLE operational.billing_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  business_id UUID NOT NULL REFERENCES operational.businesses(id) ON DELETE RESTRICT,
  billing_customer_id UUID NOT NULL REFERENCES operational.billing_customers(id) ON DELETE RESTRICT,
  plan_id UUID NOT NULL REFERENCES operational.billing_plans(id) ON DELETE RESTRICT,
  default_payment_method_id UUID REFERENCES operational.billing_payment_methods(id) ON DELETE SET NULL,

  status operational.subscription_status NOT NULL DEFAULT 'trialing',

  -- Period tracking
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,

  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_at TIMESTAMPTZ,

  -- Access gates
  grace_period_ends_at TIMESTAMPTZ,  -- allow access briefly after past_due
  suspended_at TIMESTAMPTZ,

  -- Provider references
  provider_name TEXT,
  provider_subscription_ref TEXT,

  -- Snapshot of entitlements at time (so plan changes don’t rewrite history)
  limits_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  features_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_billing_subs_limits_object CHECK (jsonb_typeof(limits_snapshot) = 'object'),
  CONSTRAINT chk_billing_subs_features_object CHECK (jsonb_typeof(features_snapshot) = 'object'),
  CONSTRAINT chk_billing_subs_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

-- Indexes
-- A business can have many historical subscriptions, but typically one "current" non-cancelled or non-expired.
CREATE INDEX idx_billing_subs_business_status
  ON operational.billing_subscriptions (business_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_billing_subs_provider_ref
  ON operational.billing_subscriptions (provider_name, provider_subscription_ref)
  WHERE deleted_at IS NULL AND provider_subscription_ref IS NOT NULL;

-- Triggers
CREATE TRIGGER trg_billing_subscriptions_set_updated_at
BEFORE UPDATE ON operational.billing_subscriptions
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();
      `,
    )
    .execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
DROP TABLE IF EXISTS operational.billing_subscriptions;
DROP TYPE IF EXISTS operational.subscription_status;
      `,
    )
    .execute(db);
}
