import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Implements FIFO costing by tracking "cost layers" for each inventory intake.
-- Each time inventory is received, a new cost layer is created with the quantity and unit cost.
-- When inventory is consumed (e.g., through a sale), it reduces the quantity_remaining in the oldest non-empty layer(s).
-- This allows us to calculate COGS accurately based on the actual cost of the specific inventory items sold, following the FIFO method.

CREATE TABLE operational.inventory_cost_layers (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id),
  product_variant_id UUID NOT NULL REFERENCES operational.product_variants(id),
  
  -- Link to the original intake event
  purchase_receipt_line_id UUID REFERENCES operational.purchase_receipt_lines(id),
  source_movement_id UUID REFERENCES operational.inventory_movements(id) NOT NULL,

  -- Costing Data
  unit_cost DECIMAL(19,4) NOT NULL, -- This is the Landed Cost at time of receipt
  
  -- The "Bucket" Logic
  quantity_received DECIMAL(19,6) NOT NULL, -- Original amount intake
  quantity_remaining DECIMAL(19,6) NOT NULL, -- What is left to be "consumed" by sales
  
  -- Status
  is_fully_consumed BOOLEAN GENERATED ALWAYS AS (quantity_remaining = 0) STORED,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at TIMESTAMPTZ, -- When quantity_remaining reached 0

  CONSTRAINT chk_cost_layers_qty_nonnegative CHECK (quantity_remaining >= 0)
);

-- Index for FIFO: Finding the oldest non-empty bucket quickly
CREATE INDEX idx_cost_layers_fifo_lookup 
  ON operational.inventory_cost_layers (store_id, product_variant_id, created_at ASC) 
  WHERE (quantity_remaining > 0);

-- RLS: (tenant-scoped)
ALTER TABLE operational.inventory_cost_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.inventory_cost_layers FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_cost_layers ON operational.inventory_cost_layers
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_cost_layers_ins ON operational.inventory_cost_layers
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
DROP TABLE IF EXISTS operational.inventory_cost_layers;
      `,
    )
    .execute(db);
}
