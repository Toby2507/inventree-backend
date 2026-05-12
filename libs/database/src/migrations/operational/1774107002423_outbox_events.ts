import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Durable outbox event log.
-- Written in the SAME transaction as domain changes.
-- Outbox processor claims events via lease fields, publishes to BullMQ, then marks published.

CREATE TYPE operational.outbox_event_status AS ENUM (
  'pending',     -- ready to publish
  'locked',      -- claimed by a processor (lease)
  'published',   -- published successfully
  'failed',      -- permanently failed (dead-letter)
  'cancelled'    -- admin/system cancelled (rare)
);

CREATE TYPE operational.outbox_destination AS ENUM (
  'bullmq'       -- you can add 'kafka', 'sns', etc later without migrations elsewhere
);

CREATE TABLE operational.outbox_events (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  -- Tenant scope for routing/analytics. Nullable for platform-wide events.
  store_id UUID REFERENCES operational.stores(id),

  destination operational.outbox_destination NOT NULL DEFAULT 'bullmq',
  status operational.outbox_event_status NOT NULL DEFAULT 'pending',

  -- Event identity
  event_type TEXT NOT NULL,            -- e.g. 'pos.transaction.completed'
  schema_version INT NOT NULL DEFAULT 1,

  -- Aggregate identity (DDD-friendly)
  aggregate_type TEXT,                 -- e.g. 'pos_transaction', 'inventory_adjustment'
  aggregate_id UUID,                   -- aggregate root id (if applicable)

  -- Ordering + correlation
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- time of domain event
  trace_id UUID,                       -- request trace/correlation
  correlation_id UUID,                 -- business flow correlation (optional)
  causation_id UUID,                   -- parent event id (optional)

  -- Routing
  partition_key TEXT,                  -- e.g. store_id::text or aggregate_id::text (helps ordered processing per key)

  -- Fully denormalised payload: consumers must not query operational DB.
  payload JSONB NOT NULL,

  -- Processor state (leasing)
  locked_at TIMESTAMPTZ,
  locked_by TEXT,                      -- processor instance id
  lock_expires_at TIMESTAMPTZ,         -- lease timeout

  publish_attempts INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ, -- NULL when no further attempts planned

  published_at TIMESTAMPTZ,
  publish_ref TEXT,                    -- provider/queue ref (optional)
  last_error TEXT,                     -- last error message (truncate in app)
  last_error_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,

  CONSTRAINT chk_outbox_payload_object
    CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT chk_outbox_attempts_nonnegative
    CHECK (publish_attempts >= 0),
  CONSTRAINT chk_outbox_lock_consistency
    CHECK (
      (locked_at IS NULL AND locked_by IS NULL AND lock_expires_at IS NULL)
      OR (locked_at IS NOT NULL AND locked_by IS NOT NULL AND lock_expires_at IS NOT NULL)
    ),
  CONSTRAINT chk_outbox_published_consistency
    CHECK (status <> 'published' OR published_at IS NOT NULL)
);

-- Indexes
CREATE INDEX idx_outbox_publish_queue
  ON operational.outbox_events (destination, status, next_attempt_at, occurred_at, id)
  WHERE status IN ('pending', 'locked') AND next_attempt_at IS NOT NULL;

CREATE INDEX idx_outbox_store_time
  ON operational.outbox_events (store_id, occurred_at DESC)
  WHERE store_id IS NOT NULL;

CREATE INDEX idx_outbox_aggregate
  ON operational.outbox_events (aggregate_type, aggregate_id, occurred_at DESC)
  WHERE aggregate_type IS NOT NULL AND aggregate_id IS NOT NULL;

CREATE INDEX idx_outbox_event_type_time
  ON operational.outbox_events (event_type, occurred_at DESC);

-- Optional: search inside payload (enable only if you truly need it)
-- CREATE INDEX idx_outbox_payload_gin ON operational.outbox_events USING GIN (payload);

-- No tenant RLS here by default.
-- Reason: outbox processor must read/publish across all stores.
-- Access should be controlled by DB roles (API role can INSERT; processor role can SELECT/UPDATE).
CREATE TRIGGER trg_set_outbox_events_updated_at
BEFORE UPDATE ON operational.outbox_events
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();
      `,
    )
    .execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
DROP TABLE IF EXISTS operational.outbox_events;
DROP TYPE IF EXISTS operational.outbox_event_status;
DROP TYPE IF EXISTS operational.outbox_destination;
      `,
    )
    .execute(db);
}
