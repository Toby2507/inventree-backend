import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
CREATE TYPE operational.pos_transaction_type AS ENUM ('sale', 'return');
CREATE TYPE operational.pos_transaction_status AS ENUM ('open', 'held', 'completed', 'voided');

CREATE TABLE operational.pos_transactions (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  attendant_store_member_id UUID NOT NULL REFERENCES operational.store_members(id) ON DELETE RESTRICT,
  terminal_id UUID NOT NULL REFERENCES operational.pos_terminals(id) ON DELETE RESTRICT,
  session_id UUID NOT NULL REFERENCES operational.pos_sessions(id) ON DELETE RESTRICT,
  discount_id UUID REFERENCES operational.store_discounts(id) ON DELETE SET NULL,
  -- Optional linkage for returns/refunds
  original_transaction_id UUID REFERENCES operational.pos_transactions(id),

  type operational.pos_transaction_type NOT NULL DEFAULT 'sale',
  status operational.pos_transaction_status NOT NULL DEFAULT 'open',

  -- Receipt / numbering (ties into your sequences context)
  receipt_number TEXT, -- e.g., "INV-0000123" (assigned on completion)
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,

  -- Customer info (minimal; internal POS often uses optional customer name/phone)
  customer_name TEXT,
  customer_phone TEXT,

  -- Monetary snapshot (stored to make completed txn immutable + reportable without recompute)
  currency_code CHAR(3) NOT NULL,              -- ISO-4217, from store settings at time of txn
  subtotal_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  -- total_amount = subtotal_amount - discount_amount + tax_amount + rounding_adjustment_amount
  -- Computed and stored at completion. Enforced at application layer
  total_amount NUMERIC(19,4) NOT NULL DEFAULT 0,

  -- Rounding snapshot (cash rounding rules etc.)
  rounding_adjustment_amount NUMERIC(19,4) NOT NULL DEFAULT 0, -- e.g., +0.05 / -0.05

  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_pos_transactions_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT chk_pos_transactions_money_nonnegative
    CHECK (
      subtotal_amount >= 0 AND discount_amount >= 0 AND tax_amount >= 0
      AND total_amount >= 0
    ),
  CONSTRAINT chk_pos_transactions_return_link
    CHECK (
      (type = 'sale' AND original_transaction_id IS NULL)
      OR (type = 'return' AND original_transaction_id IS NOT NULL)
    ),
  CONSTRAINT chk_pos_transactions_status_timestamps
    CHECK (
      (status = 'open' AND completed_at IS NULL AND voided_at IS NULL)
      OR (status = 'held' AND completed_at IS NULL AND voided_at IS NULL)
      OR (status = 'completed' AND completed_at IS NOT NULL AND voided_at IS NULL)
      OR (status = 'voided' AND voided_at IS NOT NULL AND completed_at IS NULL)
    )
);

-- Indexes
CREATE INDEX idx_pos_transactions_store_id_id
  ON operational.pos_transactions (store_id, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_pos_transactions_store_session
  ON operational.pos_transactions (store_id, session_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_pos_transactions_store_status_time
  ON operational.pos_transactions (store_id, status, opened_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_pos_transactions_store_terminal_time
  ON operational.pos_transactions (store_id, terminal_id, opened_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_pos_transactions_store_attendant_time
  ON operational.pos_transactions (store_id, attendant_store_member_id, opened_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX ux_pos_transactions_store_receipt_number
  ON operational.pos_transactions (store_id, receipt_number)
  WHERE deleted_at IS NULL AND receipt_number IS NOT NULL;

-- Triggers
CREATE TRIGGER trg_set_pos_transactions_updated_at
BEFORE UPDATE ON operational.pos_transactions
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS
ALTER TABLE operational.pos_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.pos_transactions FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_pos_transactions ON operational.pos_transactions
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_pos_transactions_ins ON operational.pos_transactions
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
DROP TABLE IF EXISTS operational.pos_transactions;
DROP TYPE IF EXISTS operational.pos_transaction_type;
DROP TYPE IF EXISTS operational.pos_transaction_status;
      `,
    )
    .execute(db);
}
