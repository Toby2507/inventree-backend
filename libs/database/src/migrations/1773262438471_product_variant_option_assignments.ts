import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Links product variants to their selected store_variant_options.
-- Example: "T-Shirt Red/Large" variant is linked to option "Red" (Color group)
--          and option "Large" (Size group).
-- A simple product with no options has no rows here.

CREATE TABLE operational.product_variant_option_assignments (
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  product_variant_id UUID NOT NULL REFERENCES operational.product_variants(id) ON DELETE CASCADE,
  store_variant_option_id UUID NOT NULL REFERENCES operational.store_variant_options(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (store_id, product_variant_id, store_variant_option_id)

  -- NOTE: store_variant_option_id must belong to the same store as the variant.
  -- Enforced at application layer in AssignVariantOptionUseCase.
  -- NOTE: only one option per variant group per variant is allowed.
  -- e.g., a variant cannot be both "Red" and "Blue" from the same Color group.
  -- Enforced at application layer in AssignVariantOptionUseCase.
);

-- Indexes
-- Fetch all options for a given variant (display variant label e.g. "Red / Large")
CREATE INDEX idx_variant_option_assignments_variant
  ON operational.product_variant_option_assignments (store_id, product_variant_id);

-- Reverse lookup: find all variants that have a specific option
-- e.g., "all variants with option Black"
CREATE INDEX idx_variant_option_assignments_option
  ON operational.product_variant_option_assignments (store_id, store_variant_option_id);

-- RLS: (tenant-scoped)
ALTER TABLE operational.product_variant_option_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.product_variant_option_assignments FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_variant_option_assignments ON operational.product_variant_option_assignments
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_variant_option_assignments_ins ON operational.product_variant_option_assignments
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
DROP TABLE operational.product_variant_option_assignments;
      `,
    )
    .execute(db);
}
