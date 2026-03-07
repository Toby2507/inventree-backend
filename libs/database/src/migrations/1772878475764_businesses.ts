import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
CREATE TYPE operational.business_status AS ENUM ('active', 'suspended');

CREATE TABLE operational.businesses (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  owned_by_user_id UUID NOT NULL REFERENCES operational.users(id) ON DELETE RESTRICT,
  legal_name TEXT NOT NULL,
  trading_name TEXT,
  primary_email CITEXT,
  primary_phone TEXT,
  status operational.business_status NOT NULL DEFAULT 'active',
  registration_number TEXT,
  tax_id TEXT,
  country_code CHAR(2),
  state TEXT,
  city TEXT,
  address_line_1 TEXT,
  address_line_2 TEXT,
  postal_code TEXT,
  address_extra JSONB,
  geo_location GEOGRAPHY(POINT, 4326),
  
  -- Defaults reflect primary target market (Nigeria)
  default_currency CHAR(3) NOT NULL DEFAULT 'NGN',
  default_timezone TEXT NOT NULL DEFAULT 'Africa/Lagos',

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_business_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT chk_business_address_extra_object
    CHECK (address_extra IS NULL OR jsonb_typeof(address_extra) = 'object')
);

CREATE INDEX idx_businesses_owned_by_user_id
  ON operational.businesses (owned_by_user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_businesses_status
  ON operational.businesses (status)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_businesses_registration_number
  ON operational.businesses (registration_number)
  WHERE registration_number IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_businesses_geo_location
  ON operational.businesses USING GIST (geo_location)
  WHERE geo_location IS NOT NULL;

CREATE TRIGGER trg_set_businesses_updated_at
BEFORE UPDATE ON operational.businesses
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
      `,
    )
    .execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
DROP TABLE IF EXISTS operational.businesses;
DROP TYPE IF EXISTS operational.business_status;
      `,
    )
    .execute(db);
}
