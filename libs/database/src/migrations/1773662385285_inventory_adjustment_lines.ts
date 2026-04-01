import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Lines describe per-product quantity deltas.
-- Posting creates inventory_movements of type 'adjustment' (or 'writeoff').

CREATE TYPE operational.inventory_adjustment_direction AS ENUM ('in', 'out');

CREATE TABLE operational.inventory_adjustment_lines (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  product_variant_id UUID NOT NULL REFERENCES operational.product_variants(id) ON DELETE RESTRICT,
  adjustment_id UUID NOT NULL REFERENCES operational.inventory_adjustments(id) ON DELETE CASCADE,
  location_id UUID REFERENCES operational.store_locations(id) ON DELETE SET NULL,
  reason_id UUID REFERENCES operational.inventory_adjustment_reasons(id) ON DELETE SET NULL,
  entered_uom_id UUID REFERENCES operational.store_uoms(id) ON DELETE SET NULL,
  -- Optional lot allocation for lot-tracked products
  lot_id UUID REFERENCES operational.inventory_lots(id) ON DELETE RESTRICT,
  -- Optional serial allocation for serial-tracked products  
  serial_id UUID REFERENCES operational.inventory_serials(id) ON DELETE RESTRICT,


  direction operational.inventory_adjustment_direction NOT NULL,
  quantity NUMERIC(19,6) NOT NULL, -- base units; always positive
  entered_quantity NUMERIC(19,6),

  -- Optional valuation snapshot (useful for write-offs and shrinkage reporting)
  unit_cost NUMERIC(19,4),         -- snapshot cost per base unit (often from store_products cost fields)
  line_value NUMERIC(19,4),        -- quantity * unit_cost (optional materialized)

  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_inventory_adjustment_lines_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT chk_inventory_adjustment_lines_qty_positive
    CHECK (quantity > 0),
  CONSTRAINT chk_inventory_adjustment_lines_entered_pair
    CHECK (
      (entered_uom_id IS NULL AND entered_quantity IS NULL)
      OR (entered_uom_id IS NOT NULL AND entered_quantity IS NOT NULL AND entered_quantity > 0)
    ),
  CONSTRAINT chk_inventory_adjustment_lines_value_nonnegative
    CHECK (unit_cost IS NULL OR unit_cost >= 0),
  -- A line can reference a lot or a serial but not both
  CONSTRAINT chk_adjustment_lines_lot_serial_exclusive
    CHECK (lot_id IS NULL OR serial_id IS NULL),
  -- line_value should equal quantity * unit_cost when both are set
  CONSTRAINT chk_adjustment_lines_value_consistency
    CHECK (
      line_value IS NULL
      OR unit_cost IS NULL
      OR line_value = quantity * unit_cost
    )
);

-- Indexes
CREATE INDEX idx_inventory_adjustment_lines_store_adjustment
  ON operational.inventory_adjustment_lines (store_id, adjustment_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_inventory_adjustment_lines_store_product
  ON operational.inventory_adjustment_lines (store_id, product_variant_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_inventory_adjustment_lines_store_location
  ON operational.inventory_adjustment_lines (store_id, location_id)
  WHERE deleted_at IS NULL AND location_id IS NOT NULL;

-- Triggers
CREATE TRIGGER trg_set_inventory_adjustment_lines_updated_at
BEFORE UPDATE ON operational.inventory_adjustment_lines
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS: (tenant-scoped)
ALTER TABLE operational.inventory_adjustment_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.inventory_adjustment_lines FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_inventory_adjustment_lines ON operational.inventory_adjustment_lines
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_inventory_adjustment_lines_ins ON operational.inventory_adjustment_lines
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
DROP TABLE IF EXISTS operational.inventory_adjustment_lines;
DROP TYPE IF EXISTS operational.inventory_adjustment_direction;
      `,
    )
    .execute(db);
}
