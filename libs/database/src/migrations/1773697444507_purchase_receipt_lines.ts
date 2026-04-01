import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Receipt lines: actual received quantities (base units).
-- Optional link to PO line for matching.
-- Posting receipt lines is what generates inventory movements.

CREATE TABLE operational.purchase_receipt_lines (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  product_variant_id UUID NOT NULL REFERENCES operational.product_variants(id) ON DELETE RESTRICT,
  purchase_receipt_id UUID NOT NULL REFERENCES operational.purchase_receipts(id) ON DELETE CASCADE,
  purchase_order_line_id UUID REFERENCES operational.purchase_order_lines(id) ON DELETE SET NULL,
  entered_uom_id UUID REFERENCES operational.store_uoms(id) ON DELETE SET NULL,
  -- Optional lot for lot-tracked products (created or matched on receipt)
  lot_id UUID REFERENCES operational.inventory_lots(id) ON DELETE RESTRICT,
  -- Optional serial for serial-tracked products (created on receipt)
  serial_id UUID REFERENCES operational.inventory_serials(id) ON DELETE RESTRICT,
  -- NULL = inherit from purchase_receipt.location_id
  -- NOT NULL = override for this specific line
  location_id UUID REFERENCES operational.store_locations(id) ON DELETE RESTRICT,

  received_qty DECIMAL(19,6) NOT NULL,
  entered_received_qty DECIMAL(19,6),

  unit_cost DECIMAL(19,4) NOT NULL, -- snapshot at receipt time (can differ from PO)
  line_subtotal DECIMAL(19,4) NOT NULL,
  discount_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  -- line_total = (unit_cost * quantity) - discount_amount + tax_amount
  -- Computed and stored at line addition. Enforced at application layer
  line_total DECIMAL(19,4) NOT NULL,

  -- snapshot for audit even if product changes
  product_name_snapshot TEXT NOT NULL,
  sku_snapshot TEXT,
  barcode_snapshot TEXT,

  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_purchase_receipt_lines_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT chk_purchase_receipt_lines_qty_positive
    CHECK (received_qty > 0),
  CONSTRAINT chk_purchase_receipt_lines_entered_pair
    CHECK (
      (entered_uom_id IS NULL AND entered_received_qty IS NULL)
      OR (entered_uom_id IS NOT NULL AND entered_received_qty IS NOT NULL AND entered_received_qty > 0)
    ),
  CONSTRAINT chk_purchase_receipt_lines_money_nonnegative
    CHECK (
      unit_cost >= 0 AND line_subtotal >= 0 AND discount_amount >= 0 AND tax_amount >= 0 AND line_total >= 0
    ),
  -- A line can reference a lot or a serial but not both
  CONSTRAINT chk_receipt_lines_lot_serial_exclusive
    CHECK (lot_id IS NULL OR serial_id IS NULL)
);

-- Indexes
CREATE INDEX idx_purchase_receipt_lines_store_receipt
  ON operational.purchase_receipt_lines (store_id, purchase_receipt_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_purchase_receipt_lines_store_product
  ON operational.purchase_receipt_lines (store_id, product_variant_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_purchase_receipt_lines_store_po_line
  ON operational.purchase_receipt_lines (store_id, purchase_order_line_id)
  WHERE deleted_at IS NULL AND purchase_order_line_id IS NOT NULL;

-- Triggers
CREATE TRIGGER trg_set_purchase_receipt_lines_updated_at
BEFORE UPDATE ON operational.purchase_receipt_lines
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS: (tenant-scoped)
ALTER TABLE operational.purchase_receipt_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.purchase_receipt_lines FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_purchase_receipt_lines ON operational.purchase_receipt_lines
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_purchase_receipt_lines_ins ON operational.purchase_receipt_lines
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
DROP TABLE IF EXISTS operational.purchase_receipt_lines;
      `,
    )
    .execute(db);
}
