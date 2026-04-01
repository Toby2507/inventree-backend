import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- PO line items.
-- Stores expected unit cost and quantity (base unit quantity).
-- received_qty is a convenience cache so you can show "received vs ordered" without summing receipts.

CREATE TABLE operational.purchase_order_lines (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  closed_by_store_member_id UUID REFERENCES operational.store_members(id) ON DELETE SET NULL,
  purchase_order_id UUID NOT NULL REFERENCES operational.purchase_orders(id) ON DELETE CASCADE,
  product_variant_id UUID NOT NULL REFERENCES operational.product_variants(id) ON DELETE RESTRICT,
  entered_uom_id UUID REFERENCES operational.store_uoms(id) ON DELETE SET NULL,

  ordered_qty DECIMAL(19,6) NOT NULL,
  received_qty DECIMAL(19,6) NOT NULL DEFAULT 0, -- updated when GRNs are posted
  entered_ordered_qty DECIMAL(19,6),

  unit_cost DECIMAL(19,4) NOT NULL, -- per base unit (snapshot at PO time)
  line_subtotal DECIMAL(19,4) NOT NULL,
  discount_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  -- line_total = (unit_cost * quantity) - discount_amount + tax_amount
  -- Computed and stored at line addition. Enforced at application layer
  line_total DECIMAL(19,4) NOT NULL,

  -- Snapshot of product descriptive fields for receipts even if product later changes
  product_name_snapshot TEXT NOT NULL,
  sku_snapshot TEXT,
  barcode_snapshot TEXT,
  
  -- Line closure (e.g., if line cancelled or not received before entire PO is completed)
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  closed_at TIMESTAMPTZ,
  close_reason TEXT, -- e.g., "cancelled", "not available from supplier", etc.

  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_purchase_order_lines_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT chk_purchase_order_lines_qty_positive
    CHECK (ordered_qty > 0),
  CONSTRAINT chk_purchase_order_lines_received_nonnegative
    CHECK (received_qty >= 0),
  CONSTRAINT chk_purchase_order_lines_entered_pair
    CHECK (
      (entered_uom_id IS NULL AND entered_ordered_qty IS NULL)
      OR (entered_uom_id IS NOT NULL AND entered_ordered_qty IS NOT NULL AND entered_ordered_qty > 0)
    ),
  CONSTRAINT chk_purchase_order_lines_money_nonnegative
    CHECK (
      unit_cost >= 0 AND line_subtotal >= 0 AND discount_amount >= 0 AND tax_amount >= 0 AND line_total >= 0
    ),
  CONSTRAINT chk_purchase_order_lines_closure_consistency
    CHECK (
      (is_closed = FALSE AND closed_at IS NULL AND close_reason IS NULL)
      OR (is_closed = TRUE AND closed_at IS NOT NULL)
    )
);

-- Indexes
CREATE INDEX idx_purchase_order_lines_store_po
  ON operational.purchase_order_lines (store_id, purchase_order_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_purchase_order_lines_store_product
  ON operational.purchase_order_lines (store_id, product_variant_id)
  WHERE deleted_at IS NULL;

-- Triggers
CREATE TRIGGER trg_set_purchase_order_lines_updated_at
BEFORE UPDATE ON operational.purchase_order_lines
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS: (tenant-scoped)
ALTER TABLE operational.purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.purchase_order_lines FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_purchase_order_lines ON operational.purchase_order_lines
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_purchase_order_lines_ins ON operational.purchase_order_lines
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
DROP TABLE IF EXISTS operational.purchase_order_lines;
      `,
    )
    .execute(db);
}
