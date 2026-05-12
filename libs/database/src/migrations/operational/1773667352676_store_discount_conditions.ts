import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
CREATE TYPE operational.discount_condition_type AS ENUM (
  'min_transaction_amount', -- transaction subtotal must exceed value
  'min_quantity',           -- line quantity must meet minimum
  'specific_product',       -- only applies to specific product variant
  'specific_category',      -- only applies to products in category
  'specific_tax_class',     -- only applies to products with tax class
  'member_role'             -- only applicable to specific store member roles
);

CREATE TABLE operational.store_discount_conditions (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  discount_id UUID NOT NULL REFERENCES operational.store_discounts(id) ON DELETE CASCADE,
  condition_type operational.discount_condition_type NOT NULL,
  -- Conditions in the same group are ANDed together.
  -- Conditions across groups are ORed.
  -- e.g., group 1: member_role=staff AND min_amount=10000
  --        group 2: specific_product=coke
  -- → (staff AND ₦10k+) OR (any Coke purchase)
  condition_group INT NOT NULL DEFAULT 1,
  -- Polymorphic value fields — only one populated per condition_type
  numeric_value DECIMAL(19,4),  -- min_transaction_amount, min_quantity
  uuid_value UUID,              -- specific_product, specific_category, specific_tax_class
  text_value TEXT,              -- member_role
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Immutable: no updated_at, no deleted_at
  -- To change conditions, delete and recreate
  CONSTRAINT chk_discount_conditions_value_populated
    CHECK (
      (condition_type IN ('min_transaction_amount', 'min_quantity') AND numeric_value IS NOT NULL AND uuid_value IS NULL AND text_value IS NULL)
      OR (condition_type IN ('specific_product', 'specific_category', 'specific_tax_class') AND uuid_value IS NOT NULL AND numeric_value IS NULL AND text_value IS NULL)
      OR (condition_type = 'member_role' AND text_value IS NOT NULL AND numeric_value IS NULL AND uuid_value IS NULL)
    ),
  CONSTRAINT chk_discount_conditions_group_positive
    CHECK (condition_group > 0)
);

-- Indexes
CREATE INDEX idx_store_discount_conditions_discount
  ON operational.store_discount_conditions (store_id, discount_id);

CREATE INDEX idx_store_discount_conditions_type
  ON operational.store_discount_conditions (store_id, condition_type);

-- RLS: (tenant-scoped)
ALTER TABLE operational.store_discount_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.store_discount_conditions FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_discount_conditions ON operational.store_discount_conditions
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_discount_conditions_ins ON operational.store_discount_conditions
  FOR INSERT
  WITH CHECK (store_id = current_setting('app.current_store_id', true)::UUID);

-- Immutable - deny UPDATE and DELETE at RLS level
CREATE POLICY deny_update_discount_conditions ON operational.store_discount_conditions
  FOR UPDATE USING (FALSE);

CREATE POLICY deny_delete_discount_conditions ON operational.store_discount_conditions
  FOR DELETE USING (FALSE);
      `,
    )
    .execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
DROP TABLE IF EXISTS operational.store_discount_conditions;
DROP TYPE IF EXISTS operational.discount_condition_type;
      `,
    )
    .execute(db);
}
