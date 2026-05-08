import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Payment records. No card details stored.
-- For offline payments (bank transfer), you can mark succeeded manually with proof metadata.

CREATE TYPE operational.payment_status AS ENUM (
  'pending',
  'succeeded',
  'failed',
  'refunded',
  'cancelled'
);

CREATE TABLE operational.billing_payments (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  business_id UUID NOT NULL REFERENCES operational.businesses(id) ON DELETE CASCADE,
  billing_customer_id UUID NOT NULL REFERENCES operational.billing_customers(id) ON DELETE RESTRICT,
  subscription_id UUID NOT NULL REFERENCES operational.billing_subscriptions(id) ON DELETE RESTRICT,
  invoice_id UUID REFERENCES operational.billing_invoices(id) ON DELETE RESTRICT,
  payment_method_id UUID REFERENCES operational.billing_payment_methods(id) ON DELETE RESTRICT,

  status operational.payment_status NOT NULL DEFAULT 'pending',

  currency CHAR(3) NOT NULL,
  amount NUMERIC(19,4) NOT NULL,

  payment_method TEXT,
  payment_reference TEXT,
  provider_name TEXT,
  provider_payment_ref TEXT,

  paid_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_billing_payments_metadata_object CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT chk_billing_payments_amount_nonneg CHECK (amount >= 0),
  CONSTRAINT chk_billing_payments_status_timestamps
    CHECK (
      (status = 'pending' AND paid_at IS NULL AND failed_at IS NULL)
      OR (status = 'succeeded' AND paid_at IS NOT NULL AND failed_at IS NULL)
      OR (status = 'failed' AND failed_at IS NOT NULL AND paid_at IS NULL)
      OR (status = 'refunded' AND paid_at IS NOT NULL)
      OR (status = 'cancelled' AND paid_at IS NULL)
    ),
  -- payment_method_id: set for card/recurring charges via stored payment method
  -- payment_method: free text for offline/manual payments e.g. 'bank_transfer', 'cash'
  -- At most one should be set
  CONSTRAINT chk_billing_payments_method_exclusive
    CHECK (
      payment_method_id IS NULL OR payment_method IS NULL
    )
);

-- Indexes
CREATE INDEX idx_billing_payments_business_time
  ON operational.billing_payments (business_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_billing_payments_provider_ref
  ON operational.billing_payments (provider_name, provider_payment_ref)
  WHERE deleted_at IS NULL AND provider_payment_ref IS NOT NULL;

-- Triggers
CREATE TRIGGER trg_set_billing_payments_updated_at
BEFORE UPDATE ON operational.billing_payments
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
DROP TABLE IF EXISTS operational.billing_payments;
DROP TYPE IF EXISTS operational.payment_status;
      `,
    )
    .execute(db);
}
