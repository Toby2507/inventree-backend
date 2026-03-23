import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Transfer line items (what products + qty are being moved)

CREATE TABLE operational.inventory_transfer_lines (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  transfer_id UUID NOT NULL REFERENCES operational.inventory_transfers(id) ON DELETE CASCADE,
  product_variant_id UUID NOT NULL REFERENCES operational.product_variants(id) ON DELETE RESTRICT,
  from_location_id UUID NOT NULL REFERENCES operational.store_locations(id) ON DELETE RESTRICT,
  to_location_id UUID NOT NULL REFERENCES operational.store_locations(id) ON DELETE RESTRICT,
  -- Optional lot allocation for lot-tracked products
  -- NOTE: lot_id must belong to the same product_variant. Enforced at application layer.
  lot_id UUID REFERENCES operational.inventory_lots(id) ON DELETE RESTRICT,
  -- Optional serial allocation for serial-tracked products
  -- NOTE: serial_id must belong to the same product_variant. Enforced at application layer.
  serial_id UUID REFERENCES operational.inventory_serials(id) ON DELETE RESTRICT,

  quantity NUMERIC(19,6) NOT NULL,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_inventory_transfer_lines_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT chk_inventory_transfer_lines_qty_positive
    CHECK (quantity > 0),
  CONSTRAINT chk_transfer_lines_locations_different
    CHECK (from_location_id <> to_location_id),
  -- A line can reference a lot or a serial but not both
  CONSTRAINT chk_transfer_lines_lot_serial_exclusive
    CHECK (lot_id IS NULL OR serial_id IS NULL)

);

-- Indexes
CREATE INDEX idx_inventory_transfer_lines_transfer
  ON operational.inventory_transfer_lines (store_id, transfer_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_inventory_transfer_lines_product
  ON operational.inventory_transfer_lines (store_id, product_variant_id)
  WHERE deleted_at IS NULL;

-- Triggers
CREATE TRIGGER trg_set_inventory_transfer_lines_updated_at
BEFORE UPDATE ON operational.inventory_transfer_lines
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS: (tenant-scoped)
ALTER TABLE operational.inventory_transfer_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.inventory_transfer_lines FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_inventory_transfer_lines ON operational.inventory_transfer_lines
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_inventory_transfer_lines_ins ON operational.inventory_transfer_lines
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
DROP TABLE IF EXISTS operational.inventory_transfer_lines;
      `,
    )
    .execute(db);
}
