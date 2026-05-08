import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Serial numbers for products requiring serial tracking.
-- Serial status is inventory-owned; it changes via movement allocations (sale/return/etc.)

CREATE TYPE operational.inventory_serial_status AS ENUM (
  'in_stock',
  'sold',
  'returned',
  'damaged',
  'written_off'
);

CREATE TABLE operational.inventory_serials (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  product_variant_id UUID NOT NULL REFERENCES operational.product_variants(id) ON DELETE RESTRICT,
  location_id UUID REFERENCES operational.store_locations(id) ON DELETE SET NULL,
  -- NULL = location unknown or not tracked for this serial

  serial_number TEXT NOT NULL,
  status operational.inventory_serial_status NOT NULL DEFAULT 'in_stock',

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  sold_at TIMESTAMPTZ,       -- set when status transitions to 'sold'
  returned_at TIMESTAMPTZ,   -- set when status transitions to 'returned'
  damaged_at TIMESTAMPTZ,    -- set when status transitions to 'damaged'
  written_off_at TIMESTAMPTZ, -- set when status transitions to 'written_off'

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_inventory_serials_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT chk_serial_status_timestamps
    CHECK (
      (status = 'in_stock' AND sold_at IS NULL AND returned_at IS NULL AND written_off_at IS NULL AND damaged_at IS NULL)
      OR (status = 'sold' AND sold_at IS NOT NULL)
      OR (status = 'returned' AND returned_at IS NOT NULL)
      OR (status = 'damaged' AND damaged_at IS NOT NULL)
      OR (status = 'written_off' AND written_off_at IS NOT NULL)
  )
);

-- Indexes
CREATE UNIQUE INDEX ux_inventory_serials_store_product_serial_active
  ON operational.inventory_serials (store_id, product_variant_id, serial_number)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_inventory_serials_store_product_status
  ON operational.inventory_serials (store_id, product_variant_id, status)
  WHERE deleted_at IS NULL;

-- Triggers
CREATE TRIGGER trg_set_inventory_serials_updated_at
BEFORE UPDATE ON operational.inventory_serials
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS: (tenant-scoped)
ALTER TABLE operational.inventory_serials ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.inventory_serials FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_inventory_serials ON operational.inventory_serials
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_inventory_serials_ins ON operational.inventory_serials
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
DROP TABLE IF EXISTS operational.inventory_serials;
DROP TYPE IF EXISTS operational.inventory_serial_status;
      `,
    )
    .execute(db);
}
