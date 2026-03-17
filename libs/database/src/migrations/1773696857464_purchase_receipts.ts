import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Goods receipt note (GRN): what you actually received.
-- Can be linked to a PO (recommended) or be "direct receive" (supplier invoice purchase without PO).
-- Posting a GRN is what creates inventory movements of type 'purchase' (direction 'in').

CREATE TYPE operational.purchase_receipt_status AS ENUM (
  'draft',
  'posted',
  'cancelled'
);

CREATE TABLE operational.purchase_receipts (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  created_by_store_member_id UUID REFERENCES operational.store_members(id) ON DELETE SET NULL,
  posted_by_store_member_id UUID REFERENCES operational.store_members(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES operational.store_suppliers(id) ON DELETE SET NULL,
  purchase_order_id UUID REFERENCES operational.purchase_orders(id) ON DELETE SET NULL,
  location_id UUID NOT NULL REFERENCES operational.store_locations(id) ON DELETE RESTRICT,
  -- default to store_settings.default_location_id in app for SME simplicity

  status operational.purchase_receipt_status NOT NULL DEFAULT 'draft',

  receipt_number TEXT, -- assigned from sequences on post (e.g., "GRN-0000456")
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- business time of receipt

  -- Financial snapshot (optional; many SMEs enter only quantities; still useful)
  currency_code CHAR(3) NOT NULL,
  subtotal_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  shipping_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  total_amount NUMERIC(19,4) NOT NULL DEFAULT 0,

  posted_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_purchase_receipts_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT chk_purchase_receipts_money_nonnegative
    CHECK (
      subtotal_amount >= 0 AND discount_amount >= 0 AND tax_amount >= 0
      AND shipping_amount >= 0 AND total_amount >= 0
    ),
  CONSTRAINT chk_purchase_receipts_status_timestamps
    CHECK (
      (status = 'draft' AND posted_at IS NULL AND cancelled_at IS NULL)
      OR (status = 'posted' AND posted_at IS NOT NULL AND cancelled_at IS NULL)
      OR (status = 'cancelled' AND cancelled_at IS NOT NULL AND posted_at IS NULL)
    )
);

-- Indexes
CREATE INDEX idx_purchase_receipts_store_id_id
  ON operational.purchase_receipts (store_id, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_purchase_receipts_store_status_time
  ON operational.purchase_receipts (store_id, status, received_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_purchase_receipts_store_po
  ON operational.purchase_receipts (store_id, purchase_order_id)
  WHERE deleted_at IS NULL AND purchase_order_id IS NOT NULL;

CREATE UNIQUE INDEX ux_purchase_receipts_store_receipt_number_active
  ON operational.purchase_receipts (store_id, receipt_number)
  WHERE deleted_at IS NULL AND receipt_number IS NOT NULL;

-- Triggers
CREATE TRIGGER trg_set_purchase_receipts_updated_at
BEFORE UPDATE ON operational.purchase_receipts
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS: (tenant-scoped)
ALTER TABLE operational.purchase_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.purchase_receipts FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_purchase_receipts ON operational.purchase_receipts
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_purchase_receipts_ins ON operational.purchase_receipts
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
DROP TABLE IF EXISTS operational.purchase_receipts;
DROP TYPE IF EXISTS operational.purchase_receipt_status;
      `,
    )
    .execute(db);
}
