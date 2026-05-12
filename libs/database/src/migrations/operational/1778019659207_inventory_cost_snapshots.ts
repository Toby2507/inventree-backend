import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Value ledger for cost analysis

CREATE TABLE operational.inventory_cost_snapshots (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id),
  product_variant_id UUID NOT NULL REFERENCES operational.product_variants(id),
  
  -- The Valuation Metrics (The "What")
  average_cost DECIMAL(19,4) NOT NULL,    -- Current WAC (Weighted Average Cost)
  last_purchase_cost DECIMAL(19,4),       -- The landed cost from the latest receipt
  standard_cost DECIMAL(19,4),            -- Predefined/Budgeted cost (for variance analysis)
  
  -- The Context (The "Why")
  quantity_on_hand_at_snap DECIMAL(19,4) NOT NULL, -- Stock level when this cost was calculated
  total_inventory_value DECIMAL(19,4) NOT NULL,    -- Qty * Avg Cost (Asset value)

  -- Traceability (The "When")
  -- Link to the movement or document that triggered this update
  source_movement_id UUID REFERENCES operational.inventory_movements(id),
  source_document_type TEXT, -- e.g., 'purchase_receipt', 'stock_adjustment', 'return'
  source_document_id UUID,   -- ID of the Receipt or Adjustment

  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT fk_inventory_cost_snapshots_product_variants
    FOREIGN KEY (store_id, product_variant_id)
    REFERENCES operational.product_variants(store_id, id),
  CONSTRAINT chk_cost_snapshots_nonnegative 
    CHECK (average_cost >= 0 AND quantity_on_hand_at_snap >= -999999) 
    -- Allows small negative buffer for "sell before receive" scenarios
);

-- Index for point-in-time financial reporting
CREATE INDEX idx_cost_snapshots_variant_time 
  ON operational.inventory_cost_snapshots (product_variant_id, computed_at DESC);

-- RLS: (tenant-scoped)
ALTER TABLE operational.inventory_cost_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.inventory_cost_snapshots FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_cost_snapshots ON operational.inventory_cost_snapshots
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_cost_snaptshots_ins ON operational.inventory_cost_snapshots
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
DROP TABLE IF EXISTS operational.inventory_cost_snapshots;
      `,
    )
    .execute(db);
}
