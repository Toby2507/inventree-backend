import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Billing profile for a business entity (the payer).
-- Does NOT store card data. Provider references are stored for reconciliation.

CREATE TYPE operational.billing_customer_status AS ENUM (
  'active',
  'delinquent',
  'suspended',
  'closed'
);

CREATE TABLE operational.billing_customers (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  business_id UUID NOT NULL REFERENCES operational.businesses(id) ON DELETE CASCADE,

  status operational.billing_customer_status NOT NULL DEFAULT 'active',

  -- Contact for billing (can differ from store contact)
  billing_email CITEXT,
  billing_phone TEXT,

  -- Address fields (optional; can be used for invoices/receipts)
  billing_country_code CHAR(2),
  billing_state TEXT,
  billing_city TEXT,
  billing_local_area TEXT,
  billing_address_line1 TEXT,
  billing_address_line2 TEXT,
  billing_postal_code TEXT,

  -- Currency preference for invoicing (business-level default)
  currency CHAR(3) NOT NULL, -- ISO 4217 like 'NGN'
  timezone TEXT,             -- IANA timezone for invoice dates/display, not storage

  -- Provider identity (e.g., Paystack customer code, Stripe customer id)
  provider_name TEXT,        -- 'paystack','stripe','flutterwave' etc.
  provider_customer_ref TEXT,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_billing_customers_metadata_object CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT chk_billing_customers_provider_consistency
    CHECK (
      (provider_name IS NULL AND provider_customer_ref IS NULL)
      OR (provider_name IS NOT NULL AND provider_customer_ref IS NOT NULL)
    )
);

-- Indexes
CREATE UNIQUE INDEX ux_billing_customers_business
  ON operational.billing_customers (business_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_billing_customers_provider_ref
  ON operational.billing_customers (provider_name, provider_customer_ref)
  WHERE deleted_at IS NULL AND provider_customer_ref IS NOT NULL;

-- Triggers
CREATE TRIGGER trg_set_billing_customers_updated_at
BEFORE UPDATE ON operational.billing_customers
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- No RLS: platform-level catalog. Readable by all authenticated users.
-- Write access restricted to platform admins at application layer.
      `,
    )
    .execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
DROP TABLE IF EXISTS operational.billing_customers;
DROP TYPE IF EXISTS operational.billing_customer_status;
      `,
    )
    .execute(db);
}
