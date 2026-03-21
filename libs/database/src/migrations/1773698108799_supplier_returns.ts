import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Return to supplier (RTV) header.
-- Ledger truth lives in inventory_movements (source_type='supplier_return').
-- staging_transfer_id optionally links to the transfer that moved stock into a staging/hold location.
-- Shipment movements reference this RTV via source_type/source_id.

CREATE TYPE operational.supplier_return_status AS ENUM (
  'draft',
  'submitted',
  'approved',
  'shipped',
  'completed',
  'cancelled'
);

CREATE TABLE operational.supplier_returns (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  created_by_store_member_id UUID REFERENCES operational.store_members(id) ON DELETE SET NULL,
  approved_by_store_member_id UUID REFERENCES operational.store_members(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES operational.store_suppliers(id) ON DELETE RESTRICT,
  -- Optional linkage to originating receipt (useful for batch traceability and analytics)
  purchase_receipt_id UUID REFERENCES operational.purchase_receipts(id) ON DELETE SET NULL,
  -- Optional staging transfer (e.g., Main Stock → RTV Hold location)
  -- If present, inventory_transfers records exact locations.
  staging_transfer_id UUID REFERENCES operational.inventory_transfers(id) ON DELETE SET NULL,

  status operational.supplier_return_status NOT NULL DEFAULT 'draft',
  return_number TEXT, -- assigned from store_number_sequences (e.g., "RTV-0000123")

  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,     -- inventory_movements(supplier_return) created at this stage
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  currency_code CHAR(3) NOT NULL,
  subtotal_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  shipping_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  total_amount NUMERIC(19,4) NOT NULL DEFAULT 0,

  reason TEXT, -- "damaged", "expired", "supplier recall", etc.
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_supplier_returns_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT chk_supplier_returns_money_nonnegative
    CHECK (
      subtotal_amount >= 0 AND discount_amount >= 0 AND tax_amount >= 0
      AND shipping_amount >= 0 AND total_amount >= 0
    ),
  CONSTRAINT chk_supplier_returns_status_timestamps
    CHECK (
      (status = 'draft' AND submitted_at IS NULL AND approved_at IS NULL AND shipped_at IS NULL AND completed_at IS NULL AND cancelled_at IS NULL)
      OR (status = 'submitted' AND submitted_at IS NOT NULL AND approved_at IS NULL AND shipped_at IS NULL AND completed_at IS NULL AND cancelled_at IS NULL)
      OR (status = 'approved' AND submitted_at IS NOT NULL AND approved_at IS NOT NULL AND shipped_at IS NULL AND completed_at IS NULL AND cancelled_at IS NULL)
      OR (status = 'shipped' AND submitted_at IS NOT NULL AND approved_at IS NOT NULL AND shipped_at IS NOT NULL AND completed_at IS NULL AND cancelled_at IS NULL)
      OR (status = 'completed' AND submitted_at IS NOT NULL AND approved_at IS NOT NULL AND shipped_at IS NOT NULL AND completed_at IS NOT NULL AND cancelled_at IS NULL)
      OR (status = 'cancelled' AND cancelled_at IS NOT NULL)
    )
);

-- Indexes
CREATE INDEX idx_supplier_returns_store_id_id
  ON operational.supplier_returns (store_id, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_supplier_returns_store_status_time
  ON operational.supplier_returns (store_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX ux_supplier_returns_store_return_number_active
  ON operational.supplier_returns (store_id, return_number)
  WHERE deleted_at IS NULL AND return_number IS NOT NULL;

CREATE INDEX idx_supplier_returns_store_staging_transfer
  ON operational.supplier_returns (store_id, staging_transfer_id)
  WHERE deleted_at IS NULL AND staging_transfer_id IS NOT NULL;

CREATE INDEX idx_supplier_returns_store_receipt
  ON operational.supplier_returns (store_id, purchase_receipt_id)
  WHERE deleted_at IS NULL AND purchase_receipt_id IS NOT NULL;

-- Triggers
CREATE TRIGGER trg_set_supplier_returns_updated_at
BEFORE UPDATE ON operational.supplier_returns
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS
ALTER TABLE operational.supplier_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.supplier_returns FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_supplier_returns ON operational.supplier_returns
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_supplier_returns_ins ON operational.supplier_returns
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
DROP TABLE IF EXISTS operational.supplier_returns;
DROP TYPE IF EXISTS operational.supplier_return_status;
      `,
    )
    .execute(db);
}
