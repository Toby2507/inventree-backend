import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Immutable stock movements (ledger).
-- Every change in inventory becomes a movement. inventory_items is updated accordingly.
-- Reversals are modeled as new movements that reference the original.

CREATE TYPE operational.inventory_movement_type AS ENUM (
  'purchase',         -- receiving stock (in)
  'sale',             -- POS sale (out)
  'transfer',         -- moving stock in or out of a location
  'customer_return',  -- customer return to stock
  'supplier_return',  -- supplier return to stock
  'opening_stock',    -- initial balance entry (in)
  'adjustment'        -- covers manual corrections, write-offs, write-ons. Detail of adjustment (reason, approver, etc.) lives on inventory_adjustments table.
);
CREATE TYPE operational.inventory_movement_direction AS ENUM ('in', 'out');

CREATE TABLE operational.inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  created_by_store_member_id UUID REFERENCES operational.store_members(id) ON DELETE SET NULL,
  product_variant_id UUID NOT NULL REFERENCES operational.product_variants(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES operational.store_locations(id) ON DELETE RESTRICT,
  reversed_movement_id UUID REFERENCES operational.inventory_movements(id) ON DELETE SET NULL,
  -- Reference only - not used for calculations. Base unit quantity is always in quantity
  entered_uom_id UUID REFERENCES operational.store_uoms(id) ON DELETE SET NULL,

  movement_type operational.inventory_movement_type NOT NULL,
  direction operational.inventory_movement_direction NOT NULL,

  quantity NUMERIC(19,6) NOT NULL, -- always positive; direction determines sign semantics
  entered_quantity NUMERIC(19,6), -- optional original quantity in entered_uom for reference; not used for calculations
  
  -- Provenance / linkage to upstream domain actions (POS txn, purchase receipt, transfer, stocktake)
  source_type TEXT, -- e.g., 'pos_transaction', 'inventory_transfer', 'stocktake'
  source_id UUID,   -- id from that aggregate (no FK to avoid cross-context tight coupling)
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- business timestamp (can differ from created_at)
  
  -- Reversal support (ledger remains append-only)
  is_reversal BOOLEAN NOT NULL DEFAULT FALSE,
  
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ledger is append-only. No updates, no deletes.
  -- Corrections are modeled as new reversal movements referencing the original.

  CONSTRAINT chk_inventory_movements_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT chk_inventory_movements_qty_positive
    CHECK (quantity > 0),
  CONSTRAINT chk_inventory_movements_reversal_consistency
    CHECK (
      (is_reversal = FALSE AND reversed_movement_id IS NULL)
      OR (is_reversal = TRUE AND reversed_movement_id IS NOT NULL)
    )
);

-- Indexes
CREATE INDEX idx_inventory_movements_store_time
  ON operational.inventory_movements (store_id, occurred_at DESC);

CREATE INDEX idx_inventory_movements_store_product_time
  ON operational.inventory_movements (store_id, product_variant_id, occurred_at DESC);

CREATE INDEX idx_inventory_movements_store_location_time
  ON operational.inventory_movements (store_id, location_id, occurred_at DESC);

CREATE INDEX idx_inventory_movements_source
  ON operational.inventory_movements (store_id, source_type, source_id)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL;

CREATE INDEX idx_inventory_movements_reversed
  ON operational.inventory_movements (store_id, reversed_movement_id)
  WHERE reversed_movement_id IS NOT NULL;

CREATE INDEX idx_inventory_movements_store_type_time
  ON operational.inventory_movements (store_id, movement_type, occurred_at DESC);

-- No UPDATE policy on purpose: keep ledger immutable at the DB permission layer.

-- RLS: (tenant-scoped)
ALTER TABLE operational.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.inventory_movements FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_inventory_movements ON operational.inventory_movements
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_inventory_movements_ins ON operational.inventory_movements
  FOR INSERT
  WITH CHECK (store_id = current_setting('app.current_store_id', true)::UUID);

-- Explicitly deny UPDATE and DELETE at RLS level to enforce ledger immutability
CREATE POLICY deny_update_inventory_movements ON operational.inventory_movements
  FOR UPDATE USING (FALSE);

CREATE POLICY deny_delete_inventory_movements ON operational.inventory_movements
  FOR DELETE USING (FALSE);
      `,
    )
    .execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
DROP TABLE IF EXISTS operational.inventory_movements;
DROP TYPE IF EXISTS operational.inventory_movement_type;
DROP TYPE IF EXISTS operational.inventory_movement_direction;
      `,
    )
    .execute(db);
}
