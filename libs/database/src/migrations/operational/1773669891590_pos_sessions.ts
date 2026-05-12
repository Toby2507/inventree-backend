import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
CREATE TYPE operational.pos_session_status AS ENUM ('open', 'closed');

CREATE TABLE operational.pos_sessions (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  terminal_id UUID NOT NULL REFERENCES operational.pos_terminals(id) ON DELETE RESTRICT,
  opened_by_store_member_id UUID NOT NULL REFERENCES operational.store_members(id) ON DELETE RESTRICT,

  status operational.pos_session_status NOT NULL DEFAULT 'open',

  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,

  opening_cash_amount DECIMAL(19,4),    -- optional: starting float (cash drawer)
  closing_cash_amount DECIMAL(19,4),    -- optional: counted at close
  expected_cash_amount DECIMAL(19,4),   -- optional: 
  cash_over_short_amount DECIMAL(19,4), -- optional: closing - expected (computed/stored)

  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_pos_sessions_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT chk_pos_sessions_status_consistency
    CHECK (
      (status = 'open' AND closed_at IS NULL)
      OR (status = 'closed' AND closed_at IS NOT NULL)
    ),
  -- cash_over_short_amount = closing_cash_amount - expected_cash_amount
  -- Computed and stored at session close. Enforced at application layer.
  CONSTRAINT chk_pos_sessions_cash_consistency
    CHECK (
      cash_over_short_amount IS NULL
      OR (closing_cash_amount IS NOT NULL AND expected_cash_amount IS NOT NULL)
    )
);

-- Indexes
CREATE INDEX idx_pos_sessions_store_id_id
  ON operational.pos_sessions (store_id, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_pos_sessions_store_terminal_status
  ON operational.pos_sessions (store_id, terminal_id, status)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX ux_pos_sessions_one_open_per_terminal
  ON operational.pos_sessions (terminal_id)
  WHERE deleted_at IS NULL AND status = 'open';

-- Triggers
CREATE TRIGGER trg_set_pos_sessions_updated_at
BEFORE UPDATE ON operational.pos_sessions
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS: (tenant-scoped)
ALTER TABLE operational.pos_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.pos_sessions FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_pos_sessions ON operational.pos_sessions
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_pos_sessions_ins ON operational.pos_sessions
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
DROP TABLE IF EXISTS operational.pos_sessions;
DROP TYPE IF EXISTS operational.pos_session_status;
      `,
    )
    .execute(db);
}
