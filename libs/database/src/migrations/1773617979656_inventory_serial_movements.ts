import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Allocation of a movement to specific serial numbers.
-- For serial-tracked products, quantity should match number of serials allocated (application invariant).

CREATE TABLE operational.inventory_serial_movements (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  movement_id UUID NOT NULL REFERENCES operational.inventory_movements(id) ON DELETE RESTRICT,
  serial_id UUID NOT NULL REFERENCES operational.inventory_serials(id) ON DELETE RESTRICT,

  status_before operational.inventory_serial_status, -- NULL for first movement (purchase receipt)
  status_after operational.inventory_serial_status NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX ux_inventory_serial_movements_unique_active
  ON operational.inventory_serial_movements (movement_id, serial_id);

CREATE INDEX idx_inventory_serial_movements_store_movement
  ON operational.inventory_serial_movements (store_id, movement_id);

CREATE INDEX idx_inventory_serial_movements_store_serial
  ON operational.inventory_serial_movements (store_id, serial_id);

-- RLS: (tenant-scoped)
ALTER TABLE operational.inventory_serial_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.inventory_serial_movements FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_inventory_serial_movements ON operational.inventory_serial_movements
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_inventory_serial_movements_ins ON operational.inventory_serial_movements
  FOR INSERT
  WITH CHECK (store_id = current_setting('app.current_store_id', true)::UUID);

-- Explicitly deny UPDATE and DELETE at RLS level to enforce ledger immutability
CREATE POLICY deny_update_inventory_serial_movements ON operational.inventory_serial_movements
  FOR UPDATE
  USING (FALSE);

CREATE POLICY deny_delete_inventory_serial_movements ON operational.inventory_serial_movements
  FOR DELETE
  USING (FALSE);
      `,
    )
    .execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
DROP TABLE IF EXISTS operational.inventory_serial_movements;
      `,
    )
    .execute(db);
}
