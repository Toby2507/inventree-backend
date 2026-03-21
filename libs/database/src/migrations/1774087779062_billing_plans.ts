import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Plan catalog (platform-level). Not tenant-scoped.
-- Defines prices + included limits and feature entitlements.

CREATE TYPE operational.plan_interval AS ENUM ('month', 'year');

CREATE TABLE operational.billing_plans (
  id UUID PRIMARY KEY DEFAULT uuidv7(),

  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,

  interval operational.plan_interval NOT NULL DEFAULT 'month',
  trial_days INT NOT NULL DEFAULT 0, -- 0 = no trial; >0 = trial period in days

  price_amount DECIMAL(19,4) NOT NULL,
  currency CHAR(3) NOT NULL,

  entitlements JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- e.g., {
  --   "max_stores": 3,
  --   "max_products": 500,
  --   "max_terminals": 2,
  --   "max_members": 20,
  --   "analytics": true,
  --   "multi_location": false,
  --   "api_access": false,
  --   "report_exports": true
  -- }
  -- -1 = unlimited for numeric limits
  -- true/false for feature flags

  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT, -- sort using ASC NULLS LAST to keep nulls at the end

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_billing_plans_entitlements_object CHECK (jsonb_typeof(entitlements) = 'object'),
  CONSTRAINT chk_billing_plans_price_nonneg CHECK (price_amount >= 0)
);

-- Indexes
CREATE INDEX idx_billing_plans_price_sort
  ON operational.billing_plans (sort_order, price_amount)
  WHERE deleted_at IS NULL and is_active = TRUE;

-- Triggers
CREATE TRIGGER trg_set_billing_plans_updated_at
BEFORE UPDATE ON operational.billing_plans
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
DROP TABLE IF EXISTS operational.billing_plans;
DROP TYPE IF EXISTS operational.plan_interval;
      `,
    )
    .execute(db);
}
