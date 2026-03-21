import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Append-only audit log for store-scoped mutations.
-- Stores enough context to reconstruct "who changed what, when, and how" without querying the mutated table.
-- before_data/after_data are JSON snapshots; changed_fields is a compact list for quick filtering.

-- Immutable append-only audit log.
-- No updates or deletes ever. GDPR erasure handled by anonymizing actor fields,
-- not by deleting audit rows.
-- No UPDATE or DELETE RLS policies intentionally — immutability enforced at application layer.

CREATE TYPE operational.audit_action AS ENUM (
  'insert',
  'update',
  'soft_delete',
  'delete',   -- only used when we want to permanently remove data (e.g., GDPR), otherwise prefer 'soft_delete' for traceability
  'restore'
);

CREATE TYPE operational.audit_source AS ENUM (
  'api',
  'pos',
  'system',
  'migration',
  'import'
);

CREATE TABLE operational.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  -- store_id is NULL for platform-level events (billing, business registration, plan changes).
  -- store_id is NOT NULL for store-scoped events (inventory, POS, members).
  store_id UUID REFERENCES operational.stores(id) ON DELETE SET NULL,
  -- Actor (who did it). In your system every staff user is a store member.
  actor_user_id UUID REFERENCES operational.users(id) ON DELETE SET NULL,
  actor_store_member_id UUID REFERENCES operational.store_members(id) ON DELETE SET NULL,
  terminal_id UUID REFERENCES operational.pos_terminals(id) ON DELETE SET NULL, -- set when action originated from POS terminal mode
  session_id UUID REFERENCES operational.pos_sessions(id) ON DELETE SET NULL,

  action operational.audit_action NOT NULL,
  source operational.audit_source NOT NULL DEFAULT 'api',

  -- The domain record affected (generic to avoid coupling to every table with FKs)
  entity_table TEXT NOT NULL,         -- e.g. 'store_products', 'pos_transactions'
  entity_id UUID NOT NULL,            -- primary key of the record
  entity_display TEXT,                -- optional human-friendly label (e.g., "Indomie Noodles 70g")

  -- Request correlation (helps tracing across services and retries)
  request_id UUID,                    -- one per inbound request (API gateway/middleware)
  correlation_id UUID,                -- one per business flow across services
  idempotency_key TEXT,               -- if you use idempotency for safe retries

  -- Where it came from
  ip_address INET,
  user_agent TEXT,

  -- What changed
  changed_fields TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], -- list of column/field names changed
  -- diff: always populated. Per-field {field: {from, to}} for fast audit UI rendering.
  -- before_data/after_data: only populated for sensitive operations
  --   e.g., inventory adjustments, price overrides, member role changes.
  --   Storing full snapshots for every write would be prohibitively expensive.
  diff JSONB NOT NULL DEFAULT '{}'::JSONB,
  before_data JSONB,
  after_data JSONB,

  -- Optional justification for sensitive actions (e.g., inventory writeoff, manual correction)
  reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_audit_json_objects
    CHECK (
      (before_data IS NULL OR jsonb_typeof(before_data) = 'object')
      AND (after_data IS NULL OR jsonb_typeof(after_data) = 'object')
      AND (jsonb_typeof(diff) = 'object')
    )
);

-- Indexes
CREATE INDEX idx_audit_logs_store_time
  ON operational.audit_logs (store_id, created_at DESC);

CREATE INDEX idx_audit_logs_store_entity
  ON operational.audit_logs (store_id, entity_table, entity_id, created_at DESC);

CREATE INDEX idx_audit_logs_store_actor_time
  ON operational.audit_logs (store_id, actor_store_member_id, created_at DESC)
  WHERE actor_store_member_id IS NOT NULL;

CREATE INDEX idx_audit_logs_store_action_time
  ON operational.audit_logs (store_id, action, created_at DESC);

CREATE INDEX idx_audit_logs_changed_fields_gin
  ON operational.audit_logs USING GIN (changed_fields);

-- RLS (store-scoped)
ALTER TABLE operational.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.audit_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_audit_logs_select ON operational.audit_logs
  FOR SELECT
  USING (
    store_id IS NULL  -- platform-level events visible to platform context
    OR store_id = current_setting('app.current_store_id', true)::UUID
  );

CREATE POLICY tenant_isolation_audit_logs_ins ON operational.audit_logs
  FOR INSERT
  WITH CHECK (
    store_id IS NULL
    OR store_id = current_setting('app.current_store_id', true)::UUID
  );
      `,
    )
    .execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
DROP TABLE IF EXISTS operational.audit_logs;
DROP TYPE IF EXISTS operational.audit_action;
DROP TYPE IF EXISTS operational.audit_source;
      `,
    )
    .execute(db);
}
