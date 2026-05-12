import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Adjustment document header. Draft -> posted (creates inventory_movements) -> cancelled.
-- This is used for manual corrections and write-offs outside stocktake workflows.

CREATE TYPE operational.inventory_adjustment_status AS ENUM ('draft', 'submitted', 'approved', 'posted', 'cancelled');
CREATE TYPE operational.inventory_adjustment_kind AS ENUM ('manual_adjustment', 'writeoff', 'writeon');

CREATE TABLE operational.inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  created_by_store_member_id UUID REFERENCES operational.store_members(id) ON DELETE SET NULL,
  -- NOTE: approved_by_store_member_id must be set when status = 'approved' or 'posted'.
  -- NOTE: posted_by_store_member_id must be set when status = 'posted'.
  -- Enforced at application layer in ApproveAdjustmentUseCase and PostAdjustmentUseCase.
  approved_by_store_member_id UUID REFERENCES operational.store_members(id) ON DELETE SET NULL,
  posted_by_store_member_id UUID REFERENCES operational.store_members(id) ON DELETE SET NULL,

  status operational.inventory_adjustment_status NOT NULL DEFAULT 'draft',
  kind operational.inventory_adjustment_kind NOT NULL DEFAULT 'manual_adjustment',

  adjustment_number TEXT, -- from store_number_sequences on post (e.g., "ADJ-0001023")
  source_type TEXT, -- optional reference to the source of the adjustment (e.g., "stocktake", "transfer", "external_system")
  source_id UUID, -- optional reference to the source entity (e.g., inventory_stocktakes.id)

  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- business time of the adjustment
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- App invariant: posted and cancelled adjustments are immutable (no updates allowed)
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_inventory_adjustments_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT chk_inventory_adjustments_status_timestamps
    CHECK (
      (status = 'draft' AND submitted_at IS NULL AND approved_at IS NULL AND posted_at IS NULL AND cancelled_at IS NULL)
      OR (status = 'submitted' AND submitted_at IS NOT NULL AND approved_at IS NULL AND posted_at IS NULL AND cancelled_at IS NULL)
      OR (status = 'approved' AND submitted_at IS NOT NULL AND approved_at IS NOT NULL AND posted_at IS NULL AND cancelled_at IS NULL)
      OR (status = 'posted' AND submitted_at IS NOT NULL AND approved_at IS NOT NULL AND posted_at IS NOT NULL AND cancelled_at IS NULL)
      OR (status = 'cancelled' AND cancelled_at IS NOT NULL)
    )
);

-- Indexes
CREATE INDEX idx_inventory_adjustments_store_id_id
  ON operational.inventory_adjustments (store_id, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_inventory_adjustments_store_status_time
  ON operational.inventory_adjustments (store_id, status, occurred_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX ux_inventory_adjustments_store_number_active
  ON operational.inventory_adjustments (store_id, adjustment_number)
  WHERE deleted_at IS NULL AND adjustment_number IS NOT NULL;

-- Triggers
CREATE TRIGGER trg_set_inventory_adjustments_updated_at
BEFORE UPDATE ON operational.inventory_adjustments
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS
ALTER TABLE operational.inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.inventory_adjustments FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_inventory_adjustments ON operational.inventory_adjustments
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_inventory_adjustments_ins ON operational.inventory_adjustments
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
DROP TABLE IF EXISTS operational.inventory_adjustments;
DROP TYPE IF EXISTS operational.inventory_adjustment_status;
DROP TYPE IF EXISTS operational.inventory_adjustment_kind;
      `,
    )
    .execute(db);
}
