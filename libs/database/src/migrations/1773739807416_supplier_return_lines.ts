import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Items being returned to supplier (base units).
-- Completing/shipping triggers inventory movements (write stock out).

CREATE TABLE operational.supplier_return_lines (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  supplier_return_id UUID NOT NULL REFERENCES operational.supplier_returns(id) ON DELETE CASCADE,
  product_variant_id UUID NOT NULL REFERENCES operational.product_variants(id) ON DELETE RESTRICT,
  purchase_order_line_id UUID REFERENCES operational.purchase_order_lines(id) ON DELETE SET NULL,
  entered_uom_id UUID REFERENCES operational.store_uoms(id) ON DELETE SET NULL,
  -- Optional lot for lot-tracked products (created or matched on receipt)
  lot_id UUID REFERENCES operational.inventory_lots(id) ON DELETE RESTRICT,
  -- Optional serial for serial-tracked products (created on receipt)
  serial_id UUID REFERENCES operational.inventory_serials(id) ON DELETE RESTRICT,

  return_qty NUMERIC(19,6) NOT NULL,
  entered_return_qty NUMERIC(19,6),

  unit_cost NUMERIC(19,4) NOT NULL, -- snapshot cost for valuation
  line_subtotal NUMERIC(19,4) NOT NULL,
  discount_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  -- line_total = (unit_cost * quantity) - discount_amount + tax_amount
  -- Computed and stored at line addition. Enforced at application layer
  line_total NUMERIC(19,4) NOT NULL,

  -- snapshot for audit even if product changes
  product_name_snapshot TEXT NOT NULL,
  sku_snapshot TEXT,
  barcode_snapshot TEXT,

  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_supplier_return_lines_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT chk_supplier_return_lines_qty_positive
    CHECK (return_qty > 0),
  CONSTRAINT chk_supplier_return_lines_entered_pair
    CHECK (
      (entered_uom_id IS NULL AND entered_return_qty IS NULL)
      OR (entered_uom_id IS NOT NULL AND entered_return_qty IS NOT NULL AND entered_return_qty > 0)
    ),
  -- A line can reference a lot or a serial but not both
  CONSTRAINT chk_supplier_return_lines_lot_serial_exclusive
    CHECK (lot_id IS NULL OR serial_id IS NULL)
);

-- Indexes
CREATE INDEX idx_supplier_return_lines_store_return
  ON operational.supplier_return_lines (store_id, supplier_return_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_supplier_return_lines_store_product
  ON operational.supplier_return_lines (store_id, product_variant_id)
  WHERE deleted_at IS NULL;

-- Triggers
CREATE TRIGGER trg_set_supplier_return_lines_updated_at
BEFORE UPDATE ON operational.supplier_return_lines
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS: (tenant-scoped)
ALTER TABLE operational.supplier_return_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.supplier_return_lines FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_supplier_return_lines ON operational.supplier_return_lines
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_supplier_return_lines_ins ON operational.supplier_return_lines
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
DROP TABLE IF EXISTS operational.supplier_return_lines;
      `,
    )
    .execute(db);
}
