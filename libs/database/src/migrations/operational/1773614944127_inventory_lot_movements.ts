import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Allocation of a movement's quantity to specific lots.
-- Required when store_product.requires_lot_tracking = true (application invariant).

CREATE TABLE operational.inventory_lot_movements (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  movement_id UUID NOT NULL REFERENCES operational.inventory_movements(id) ON DELETE RESTRICT,
  lot_id UUID NOT NULL REFERENCES operational.inventory_lots(id) ON DELETE RESTRICT,

  quantity NUMERIC(19,6) NOT NULL, -- portion of movement quantity assigned to this lot

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Immutable join between inventory_movements and inventory_lots.
  -- No updates or deletes. Reversals create new lot movement rows referencing the reversal movement.

  CONSTRAINT chk_inventory_lot_movements_qty_positive
    CHECK (quantity > 0)
);

-- Indexes
CREATE UNIQUE INDEX ux_inventory_lot_movements_unique_active
  ON operational.inventory_lot_movements (movement_id, lot_id);

CREATE INDEX idx_inventory_lot_movements_store_movement
  ON operational.inventory_lot_movements (store_id, movement_id);

CREATE INDEX idx_inventory_lot_movements_store_lot
  ON operational.inventory_lot_movements (store_id, lot_id);

-- RLS: (tenant-scoped)
ALTER TABLE operational.inventory_lot_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.inventory_lot_movements FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_inventory_lot_movements ON operational.inventory_lot_movements
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_inventory_lot_movements_ins ON operational.inventory_lot_movements
  FOR INSERT
  WITH CHECK (store_id = current_setting('app.current_store_id', true)::UUID);

-- Explicitly deny UPDATE and DELETE at RLS level to enforce ledger immutability
CREATE POLICY deny_update_inventory_lot_movements ON operational.inventory_lot_movements
  FOR UPDATE USING (FALSE);

CREATE POLICY deny_delete_inventory_lot_movements ON operational.inventory_lot_movements
  FOR DELETE USING (FALSE);
      `,
    )
    .execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
DROP TABLE IF EXISTS operational.inventory_lot_movements;
      `,
    )
    .execute(db);
}
