import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
CREATE TYPE operational.store_status AS ENUM ('active', 'suspended', 'closed');

CREATE TABLE operational.stores (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  business_id UUID NOT NULL REFERENCES operational.businesses(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,  -- unique per business (e.g., "IKEJA-01")
  name TEXT NOT NULL,
  email CITEXT,
  phone TEXT,
  status operational.store_status NOT NULL DEFAULT 'active',
  country_code CHAR(2) NOT NULL,
  state TEXT NOT NULL,
  city TEXT NOT NULL,
  address_line_1 TEXT NOT NULL,
  address_line_2 TEXT,
  postal_code TEXT,
  address_extra JSONB,
  geo_location GEOGRAPHY(POINT, 4326),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_store_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT chk_address_extra_object
    CHECK (address_extra IS NULL OR jsonb_typeof(address_extra) = 'object')
);

CREATE UNIQUE INDEX ux_stores_business_code_active
  ON operational.stores (business_id, code)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_stores_business
  ON operational.stores (business_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_stores_status
  ON operational.stores (status)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_stores_country
  ON operational.stores (country_code)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_stores_state
  ON operational.stores (state)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_stores_city
  ON operational.stores (city)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_stores_geo_location
  ON operational.stores USING GIST (geo_location)
  WHERE geo_location IS NOT NULL;

CREATE TRIGGER trg_set_stores_updated_at
BEFORE UPDATE ON operational.stores
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Circular reference resolved: businesses.primary_store_id added after stores exists
-- NOTE: primary_store_id must reference a store belonging to this business.
-- Enforced at application layer.
ALTER TABLE operational.businesses
ADD COLUMN primary_store_id UUID REFERENCES operational.stores(id) ON DELETE SET NULL;

CREATE INDEX idx_businesses_primary_store
  ON operational.businesses (primary_store_id)
  WHERE deleted_at IS NULL AND primary_store_id IS NOT NULL;
      `,
    )
    .execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
DROP INDEX IF EXISTS idx_businesses_primary_store;
ALTER TABLE operational.businesses DROP COLUMN IF EXISTS primary_store_id;
DROP TABLE IF EXISTS operational.stores;
DROP TYPE IF EXISTS operational.store_status;
      `,
    )
    .execute(db);
}
