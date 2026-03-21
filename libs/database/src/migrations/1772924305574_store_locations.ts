import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Physical + virtual inventory locations within a store.
-- Supports hierarchy (warehouse -> aisle -> shelf -> bin) via ltree materialized path.
-- Virtual locations (e.g., "Damaged", "Returns", "In-Transit") use location_type = 'virtual'.

CREATE TYPE operational.location_type AS ENUM (
  -- Level 1: Macro Physical Areas
  'room',         -- e.g., Backroom, Showroom, Cold Storage
  'zone',         -- e.g., Receiving Dock, High-Value Cage, Shipping
  
  -- Level 2: Navigation & Organization
  'aisle',        -- e.g., Aisle A, Aisle 12
  'bay',          -- A vertical section of an aisle or rack
  
  -- Level 3: Storage Fixtures
  'rack',         -- Heavy-duty pallet racking
  'shelf',        -- Standard shelving unit or tier
  'display',      -- Sales floor endcaps, tables, or mannequins
  
  -- Level 4: Specific Storage Points (Leaf Nodes)
  'bin',          -- Small pickable containers
  'slot',         -- Specifically sized space on a shelf
  'peg',          -- For hanging items (hooks/pegs)
  'pallet_pos',   -- A marked spot on the floor for a full pallet
  
  -- Level 5: Virtual & Logical
  'virtual',      -- For "In-Transit", "Returns", or "Staging"
  'other'         -- Fallback for unique store setups
);

CREATE TABLE operational.store_locations (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  created_by_store_member_id UUID REFERENCES operational.store_members(id) ON DELETE SET NULL,
  -- Hard delete of parent blocked by RESTRICT.
  -- Soft-deleting a parent with active children must be prevented at application layer.
  parent_location_id UUID REFERENCES operational.store_locations(id) ON DELETE RESTRICT,

  name TEXT NOT NULL,                 -- e.g., "Main Warehouse", "Shelf A3"
  normalized_name TEXT NOT NULL,      -- app-normalized for dedupe/search

  code TEXT NOT NULL,           -- short code for scanning/labels
  -- ltree path using dot-separated sanitized codes.
  -- e.g., "MAIN_WH.ASL_001.SHF_003"
  -- codes sanitized at app layer: hyphens -> underscores, spaces removed
  path LTREE NOT NULL,

  location_type operational.location_type NOT NULL DEFAULT 'room',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT,  -- sort using ASC NULLS LAST to keep nulls at the end.

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_store_locations_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object')
);

-- Indexes
CREATE INDEX idx_store_locations_store_created
  ON operational.store_locations (store_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_store_locations_store_parent
  ON operational.store_locations (store_id, parent_location_id)
  WHERE deleted_at IS NULL AND parent_location_id IS NOT NULL;

CREATE UNIQUE INDEX ux_store_locations_store_normalized_name_active
  ON operational.store_locations (store_id, normalized_name)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX ux_store_locations_store_code_active
  ON operational.store_locations (store_id, code)
  WHERE deleted_at IS NULL;

-- GiST index required for ltree operators (@>, <@, ~, ?)
CREATE INDEX idx_store_locations_path
  ON operational.store_locations USING GIST (path)
  WHERE deleted_at IS NULL;

-- Triggers
CREATE TRIGGER trg_set_store_locations_updated_at
BEFORE UPDATE ON operational.store_locations
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS (tenant-scoped)
ALTER TABLE operational.store_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.store_locations FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_store_locations ON operational.store_locations
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_store_locations_ins ON operational.store_locations
  FOR INSERT
  WITH CHECK (store_id = current_setting('app.current_store_id', true)::UUID);

-- Circular reference resolved: store_settings.default_location_id added after store_locations exists
-- NOTE: default_location_id must reference a location belonging to this store.
-- Enforced at application layer.
ALTER TABLE operational.store_settings
ADD COLUMN IF NOT EXISTS default_location_id UUID REFERENCES operational.store_locations(id) ON DELETE SET NULL;

CREATE INDEX idx_store_settings_default_location
  ON operational.store_settings (default_location_id)
  WHERE default_location_id IS NOT NULL;
      `,
    )
    .execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
DROP INDEX IF EXISTS operational.idx_store_settings_default_location;
ALTER TABLE operational.store_settings DROP COLUMN IF EXISTS default_location_id;
DROP TABLE IF EXISTS operational.store_locations;
DROP TYPE IF EXISTS operational.location_type;
      `,
    )
    .execute(db);
}
