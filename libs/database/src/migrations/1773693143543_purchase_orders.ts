import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Purchase Orders (POs): intent to buy items at expected costs.
-- Industry standard flow: draft -> submitted -> approved -> partially_received -> received -> cancelled.
-- Many SMEs skip approval; your app can auto-approve on submit if desired.

CREATE TYPE operational.purchase_order_status AS ENUM (
  'draft',
  'submitted',
  'approved',
  'sent', -- optional step to track if PO sent to supplier (e.g., via email)
  'partially_received',
  'received',
  'cancelled'
);

CREATE TABLE operational.purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES operational.store_suppliers(id) ON DELETE SET NULL,
  created_by_store_member_id UUID REFERENCES operational.store_members(id) ON DELETE SET NULL,
  approved_by_store_member_id UUID REFERENCES operational.store_members(id) ON DELETE SET NULL,

  status operational.purchase_order_status NOT NULL DEFAULT 'draft',
  po_number TEXT, -- assigned from sequences on submit/approve (e.g., "PO-0000123")

  ordered_at TIMESTAMPTZ,         -- when it was placed with supplier
  expected_delivery_at TIMESTAMPTZ,

  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  first_receipt_at TIMESTAMPTZ,  -- when first receipt created (transitions to partially_received)
  fully_received_at TIMESTAMPTZ, -- when all lines fully received (transitions to received)

  -- Snapshot financials (for reporting; derived from lines)
  currency_code CHAR(3) NOT NULL,
  subtotal_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  shipping_amount NUMERIC(19,4) NOT NULL DEFAULT 0, -- optional freight
  total_amount NUMERIC(19,4) NOT NULL DEFAULT 0,

  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_purchase_orders_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT chk_purchase_orders_money_nonnegative
    CHECK (
      subtotal_amount >= 0 AND discount_amount >= 0 AND tax_amount >= 0
      AND shipping_amount >= 0 AND total_amount >= 0
    ),
  CONSTRAINT chk_purchase_orders_status_timestamps
    CHECK (
      (status = 'draft' AND submitted_at IS NULL AND approved_at IS NULL AND sent_at IS NULL AND cancelled_at IS NULL)
      OR (status = 'submitted' AND submitted_at IS NOT NULL AND approved_at IS NULL AND sent_at IS NULL AND cancelled_at IS NULL)
      OR (status = 'approved' AND submitted_at IS NOT NULL AND approved_at IS NOT NULL AND sent_at IS NULL AND cancelled_at IS NULL)
      OR (status = 'sent' AND submitted_at IS NOT NULL AND approved_at IS NOT NULL AND sent_at IS NOT NULL AND cancelled_at IS NULL)
      OR (status = 'partially_received' AND submitted_at IS NOT NULL AND approved_at IS NOT NULL AND first_receipt_at IS NOT NULL AND cancelled_at IS NULL)
      OR (status = 'received' AND submitted_at IS NOT NULL AND approved_at IS NOT NULL AND fully_received_at IS NOT NULL AND cancelled_at IS NULL)
      OR (status = 'cancelled' AND cancelled_at IS NOT NULL)
    )
);

-- Indexes
CREATE INDEX idx_purchase_orders_store_id_id
  ON operational.purchase_orders (store_id, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_purchase_orders_store_status_time
  ON operational.purchase_orders (store_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_purchase_orders_store_supplier_time
  ON operational.purchase_orders (store_id, supplier_id, created_at DESC)
  WHERE deleted_at IS NULL AND supplier_id IS NOT NULL;

CREATE UNIQUE INDEX ux_purchase_orders_store_po_number_active
  ON operational.purchase_orders (store_id, po_number)
  WHERE deleted_at IS NULL AND po_number IS NOT NULL;

-- Triggers
CREATE TRIGGER trg_set_purchase_orders_updated_at
BEFORE UPDATE ON operational.purchase_orders
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS: (tenant-scoped)
ALTER TABLE operational.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.purchase_orders FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_purchase_orders ON operational.purchase_orders
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_purchase_orders_ins ON operational.purchase_orders
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
DROP TABLE IF EXISTS operational.purchase_orders;
DROP TYPE IF EXISTS operational.purchase_order_status;
      `,
    )
    .execute(db);
}
