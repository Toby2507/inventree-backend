import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Global barcode registry (platform-wide).
-- Does NOT define a "global product" entity; it just records what a barcode appears to represent.
-- Used for exact cross-store match and later FindIt/global search intelligence.

CREATE TYPE operational.barcode_status AS ENUM ('active', 'deprecated');
CREATE TYPE operational.barcode_type AS ENUM ('ean_13', 'ean_8', 'upc_a', 'upc_e','code_128', 'code_39', 'qr', 'data_matrix', 'other');


CREATE TABLE operational.barcode_registry (
  id UUID PRIMARY KEY DEFAULT uuidv7(),

  -- Provenance (first seen)
  first_seen_store_id UUID REFERENCES operational.stores(id) ON DELETE SET NULL,
  first_seen_at TIMESTAMPTZ,

  barcode TEXT NOT NULL, -- keep as text (leading zeros possible)
  barcode_type operational.barcode_type,
  status operational.barcode_status NOT NULL DEFAULT 'active',

  -- Optional canonical hints (NOT authoritative; derived from observations or admin cleanup later)
  suggested_name TEXT,        -- e.g., "Coca-Cola Original 500ml"
  suggested_brand TEXT,       -- free text
  suggested_category TEXT,    -- free text label/path if you want
  suggested_pack_size TEXT,   -- e.g., "500ml"

  -- Quality signals
  confidence_score NUMERIC(5,4) NOT NULL DEFAULT 0, -- 0..1, derived by worker later
  -- Incremented atomically via UPDATE SET observation_count = observation_count + 1.
  -- Never read-then-write in two separate statements.
  observation_count INT NOT NULL DEFAULT 0,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_barcode_registry_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT chk_barcode_first_seen_consistency
    CHECK (
      (first_seen_store_id IS NULL AND first_seen_at IS NULL)
      OR
      (first_seen_store_id IS NOT NULL AND first_seen_at IS NOT NULL)
    ),
  CONSTRAINT chk_barcode_registry_confidence_range
    CHECK (confidence_score >= 0 AND confidence_score <= 1),
  CONSTRAINT chk_barcode_registry_observation_nonnegative
    CHECK (observation_count >= 0)
);

-- Indexes
CREATE UNIQUE INDEX ux_barcode_registry_barcode_active
  ON operational.barcode_registry (barcode)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_barcode_registry_status
  ON operational.barcode_registry (status)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_barcode_registry_suggested_name_trgm
  ON operational.barcode_registry USING GIN (suggested_name gin_trgm_ops)
  WHERE deleted_at IS NULL AND suggested_name IS NOT NULL;

-- Triggers
CREATE TRIGGER trg_set_barcode_registry_updated_at
BEFORE UPDATE ON operational.barcode_registry
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- No RLS: platform-scoped table. All stores can read the registry.
-- Write access controlled at application layer only.
      `,
    )
    .execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
DROP TABLE IF EXISTS operational.barcode_registry;
DROP TYPE IF EXISTS operational.barcode_status;
DROP TYPE IF EXISTS operational.barcode_type;
      `,
    )
    .execute(db);
}
