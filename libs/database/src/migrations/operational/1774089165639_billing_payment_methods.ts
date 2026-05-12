import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
CREATE TABLE operational.billing_payment_methods (
  id UUID PRIMARY KEY DEFAULT uuidv7(),

  business_id UUID NOT NULL REFERENCES operational.businesses(id) ON DELETE CASCADE,
  billing_customer_id UUID NOT NULL REFERENCES operational.billing_customers(id) ON DELETE RESTRICT,

  provider_name TEXT NOT NULL,                 -- 'paystack'
  provider_authorization_ref TEXT NOT NULL,    -- Paystack authorization_code (token, not PAN)

  is_default BOOLEAN NOT NULL DEFAULT FALSE,

  -- Safe, non-PCI metadata for display/debug (mask only)
  details JSONB NOT NULL DEFAULT '{}'::jsonb,  -- last4, exp_month, exp_year, bank, card_type, reusable, signature, channel

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  -- Payment methods are immutable after creation.
  -- To update, soft-delete and create a new record.
  -- No updated_at intentionally.

  CONSTRAINT chk_billing_payment_methods_details_object
    CHECK (jsonb_typeof(details) = 'object')
);

-- Indexes
CREATE INDEX idx_billing_payment_methods_business
  ON operational.billing_payment_methods (business_id, is_default, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX ux_billing_payment_methods_default_per_business
  ON operational.billing_payment_methods (business_id)
  WHERE deleted_at IS NULL AND is_default = TRUE;

-- No RLS: platform-scoped table. Access controlled at application layer.
-- A business owner can only access their own payment methods.
      `,
    )
    .execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
DROP TABLE IF EXISTS operational.billing_payment_methods;
      `,
    )
    .execute(db);
}
