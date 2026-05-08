import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Invoices generated for subscription periods or one-off charges.
-- For MVP you can keep invoices minimal and rely on provider invoices later.

CREATE TYPE operational.invoice_status AS ENUM (
  'draft',
  'issued',
  'paid',
  'void',
  'uncollectible'
);

CREATE TABLE operational.billing_invoices (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  business_id UUID NOT NULL REFERENCES operational.businesses(id) ON DELETE CASCADE,
  billing_customer_id UUID NOT NULL REFERENCES operational.billing_customers(id) ON DELETE RESTRICT,
  subscription_id UUID REFERENCES operational.billing_subscriptions(id) ON DELETE RESTRICT,

  invoice_number TEXT NOT NULL, -- your internal invoice number
  status operational.invoice_status NOT NULL DEFAULT 'issued',

  billing_period_start TIMESTAMPTZ, -- NULL for one-off charges
  billing_period_end TIMESTAMPTZ,   -- NULL for one-off charges

  currency CHAR(3) NOT NULL,
  subtotal_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  total_amount NUMERIC(19,4) NOT NULL DEFAULT 0,

  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,

  provider_name TEXT,
  provider_invoice_ref TEXT,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_billing_invoices_metadata_object CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT chk_billing_invoices_money_nonneg CHECK (
    subtotal_amount >= 0 AND tax_amount >= 0 AND discount_amount >= 0 AND total_amount >= 0
  ),
  CONSTRAINT chk_billing_invoices_status_timestamps
    CHECK (
      (status = 'draft' AND paid_at IS NULL)
      OR (status = 'issued' AND issued_at IS NOT NULL AND paid_at IS NULL)
      OR (status = 'paid' AND paid_at IS NOT NULL)
      OR (status = 'void' AND paid_at IS NULL)
      OR (status = 'uncollectible' AND paid_at IS NULL)
    ),
  CONSTRAINT chk_billing_invoices_period_consistency
    CHECK (
      (billing_period_start IS NULL AND billing_period_end IS NULL)
      OR (billing_period_start IS NOT NULL AND billing_period_end IS NOT NULL AND billing_period_end > billing_period_start)
    ),
  CONSTRAINT chk_billing_invoices_provider_consistency
    CHECK (
      (provider_name IS NULL AND provider_invoice_ref IS NULL)
      OR (provider_name IS NOT NULL AND provider_invoice_ref IS NOT NULL)
    )
);

-- Indexes
CREATE UNIQUE INDEX ux_billing_invoices_number
  ON operational.billing_invoices (invoice_number)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_billing_invoices_business_time
  ON operational.billing_invoices (business_id, issued_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_billing_invoices_provider_ref
  ON operational.billing_invoices (provider_name, provider_invoice_ref)
  WHERE deleted_at IS NULL AND provider_invoice_ref IS NOT NULL;

-- Triggers
CREATE TRIGGER trg_billing_invoices_set_updated_at
BEFORE UPDATE ON operational.billing_invoices
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
DROP TABLE IF EXISTS operational.billing_invoices;
DROP TYPE IF EXISTS operational.invoice_status;
      `,
    )
    .execute(db);
}
