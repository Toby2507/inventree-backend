import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Line items capture price/discount/tax snapshot at time of sale.
-- Quantity is stored in base units for inventory correctness.
-- entered_quantity/uom preserves cashier input (e.g., 2 cartons).

CREATE TABLE operational.pos_transaction_lines (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES operational.pos_transactions(id) ON DELETE CASCADE,
  product_variant_id UUID NOT NULL REFERENCES operational.product_variants(id) ON DELETE RESTRICT,
  discount_id UUID REFERENCES operational.store_discounts(id) ON DELETE SET NULL,
  entered_uom_id UUID REFERENCES operational.store_uoms(id) ON DELETE SET NULL,

  quantity DECIMAL(19,6) NOT NULL, -- base quantity used for inventory deduction
  entered_quantity DECIMAL(19,6),

  unit_price DECIMAL(19,4) NOT NULL,
  line_subtotal DECIMAL(19,4) NOT NULL,
  discount_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  -- line_total = (unit_price * quantity) - discount_amount + tax_amount
  -- Computed and stored at line addition. Enforced at application layer
  line_total DECIMAL(19,4) NOT NULL DEFAULT 0,

  -- Snapshot of product descriptive fields for receipts even if product later changes
  product_name_snapshot TEXT NOT NULL,
  sku_snapshot TEXT,
  barcode_snapshot TEXT,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_pos_transaction_lines_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT chk_pos_transaction_lines_qty_positive
    CHECK (quantity > 0),
  CONSTRAINT chk_pos_transaction_lines_entered_pair
    CHECK (
      (entered_uom_id IS NULL AND entered_quantity IS NULL)
      OR (entered_uom_id IS NOT NULL AND entered_quantity IS NOT NULL AND entered_quantity > 0)
    ),
  CONSTRAINT chk_pos_transaction_lines_money_nonnegative
    CHECK (
      unit_price >= 0 AND line_subtotal >= 0 AND discount_amount >= 0 AND tax_amount >= 0 AND line_total >= 0
    )
);

-- Indexes
CREATE INDEX idx_pos_transaction_lines_store_txn
  ON operational.pos_transaction_lines (store_id, transaction_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_pos_transaction_lines_product_variants
  ON operational.pos_transaction_lines (store_id, product_variant_id)
  WHERE deleted_at IS NULL;

-- Prevent accidental duplicate exact product lines? (optional)
-- Many POS systems allow multiple lines for same product (e.g., different discounts),
-- so we do NOT enforce uniqueness here.

-- Triggers
CREATE TRIGGER trg_set_pos_transaction_lines_updated_at
BEFORE UPDATE ON operational.pos_transaction_lines
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS: (tenant-scoped)
ALTER TABLE operational.pos_transaction_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.pos_transaction_lines FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_pos_transaction_lines ON operational.pos_transaction_lines
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_pos_transaction_lines_ins ON operational.pos_transaction_lines
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
DROP TABLE IF EXISTS operational.pos_transaction_lines;
      `,
    )
    .execute(db);
}
