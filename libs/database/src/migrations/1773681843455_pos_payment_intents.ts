import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Generic POS payment intent (one per transaction)
-- Captures HOW the store expects/claims payment was collected (cash/transfer/card/mixed)
-- even when payment is handled outside the system

CREATE TYPE operational.pos_payment_intent_status AS ENUM (
  'initiated',   -- intent created, payment not yet confirmed
  'pending',     -- awaiting confirmation (e.g., bank transfer)
  'confirmed',   -- payment confirmed/received (manual or automated)
  'failed',      -- payment failed (gateway) or was rejected
  'cancelled'    -- intent cancelled (e.g., transaction voided before completion)
);

CREATE TYPE operational.pos_payment_method AS ENUM (
  'cash',
  'bank_transfer',
  'card',
  'mobile_money',
  'mixed',
  'unknown'
);

CREATE TYPE operational.pos_payment_intent_type AS ENUM (
  'payment',  -- collecting money from customer
  'refund'    -- returning money to customer
);

CREATE TABLE operational.pos_payment_intents (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES operational.pos_transactions(id) ON DELETE RESTRICT,
  -- For refunds: references the original payment intent being refunded
  original_intent_id UUID REFERENCES operational.pos_payment_intents(id) ON DELETE RESTRICT,
  
  method operational.pos_payment_method NOT NULL DEFAULT 'unknown',
  status operational.pos_payment_intent_status NOT NULL DEFAULT 'initiated',
  type operational.pos_payment_intent_type NOT NULL DEFAULT 'payment',

  amount DECIMAL(19,4) NOT NULL,         -- intended/collected amount (should match txn total on completion)
  currency_code CHAR(3) NOT NULL,        -- snapshot at time of payment intent

  -- Manual cash capture (optional)
  amount_tendered DECIMAL(19,4),
  change_given DECIMAL(19,4),

  -- Manual reference (optional, non-sensitive): transfer narration, POS slip ref, etc.
  reference_text TEXT,

  -- Split breakdown (only when method='mixed')
  -- Array items are app-validated. Example:
  -- [
  --  {"method":"cash","amount":"2500.0000","amount_tendered":"3000.0000","change_given":"500.0000"},
  --  {"method":"bank_transfer","amount":"1500.0000","reference_text":"GTB ref 839201"}
  -- ]
  split_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,

  confirmed_at TIMESTAMPTZ,              -- set when status becomes confirmed
  failure_reason TEXT,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_pos_payment_intents_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT chk_pos_payment_intents_split_breakdown_array
    CHECK (jsonb_typeof(split_breakdown) = 'array'),
  CONSTRAINT chk_pos_payment_intents_amount_positive
    CHECK (amount > 0),
  -- If amount_tendered is present, change_given must be present (can be zero).
  CONSTRAINT chk_pos_payment_intents_cash_pair
    CHECK (
      (amount_tendered IS NULL AND change_given IS NULL)
      OR (amount_tendered IS NOT NULL AND change_given IS NOT NULL AND amount_tendered > 0 AND change_given >= 0)
    ),
  -- Mixed requires a non-empty breakdown (fine-grained validation is app-level)
  CONSTRAINT chk_pos_payment_intents_mixed_requires_breakdown
    CHECK (
      method <> 'mixed'
      OR jsonb_array_length(split_breakdown) > 0
    ),
  -- Confirmed status should have confirmed_at
  CONSTRAINT chk_pos_payment_intents_confirmed_timestamp
    CHECK (
      status <> 'confirmed'
      OR confirmed_at IS NOT NULL
    ),
  CONSTRAINT chk_pos_payment_intents_cash_fields_method
    CHECK (
      amount_tendered IS NULL
      OR method IN ('cash', 'mixed')
    ),
  CONSTRAINT chk_pos_payment_intents_refund_consistency
    CHECK (
      (type = 'payment' AND original_intent_id IS NULL)
      OR (type = 'refund' AND original_intent_id IS NOT NULL)
    )
);

-- Indexes
-- Enforce one payment intent per transaction (active)
CREATE UNIQUE INDEX ux_pos_payment_intents_one_payment_per_txn
  ON operational.pos_payment_intents (transaction_id)
  WHERE deleted_at IS NULL AND type = 'payment';

CREATE INDEX idx_pos_payment_intents_store_id_id
  ON operational.pos_payment_intents (store_id, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_pos_payment_intents_store_status_time
  ON operational.pos_payment_intents (store_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_pos_payment_intents_store_method_time
  ON operational.pos_payment_intents (store_id, method, created_at DESC)
  WHERE deleted_at IS NULL;

-- Triggers
CREATE TRIGGER trg_set_pos_payment_intents_updated_at
BEFORE UPDATE ON operational.pos_payment_intents
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS: (tenant-scoped)
ALTER TABLE operational.pos_payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.pos_payment_intents FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_pos_payment_intents_select ON operational.pos_payment_intents
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_pos_payment_intents_ins ON operational.pos_payment_intents
  FOR INSERT
  WITH CHECK (store_id = current_setting('app.current_store_id', true)::UUID);

-- Circular reference resolved: pos_transactions.payment_intent_id added after payment_intents exists
-- NOTE: payment_intent_id must reference a payment_intent belonging to this store.
-- Enforced at application layer.
ALTER TABLE operational.pos_transactions
ADD COLUMN payment_intent_id UUID REFERENCES operational.pos_payment_intents(id) ON DELETE SET NULL;

CREATE INDEX idx_pos_transaction_store_payment_intent
  ON operational.pos_transactions (store_id, payment_intent_id)
  WHERE deleted_at IS NULL AND payment_intent_id IS NOT NULL;
      `,
    )
    .execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
DROP INDEX IF EXISTS idx_pos_transaction_store_payment_intent;
ALTER TABLE operational.pos_transactions DROP COLUMN IF EXISTS payment_intent_id;
DROP TABLE IF EXISTS operational.pos_payment_intents;
DROP TYPE IF EXISTS operational.pos_payment_method;
DROP TYPE IF EXISTS operational.pos_payment_intent_status;
DROP TYPE IF EXISTS operational.pos_payment_intent_type;
      `,
    )
    .execute(db);
}
