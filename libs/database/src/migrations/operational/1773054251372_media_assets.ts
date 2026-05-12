import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Generic media registry.
-- Stores metadata about uploaded files (Cloudinary, S3, etc.).
-- Does NOT store binary data; only references and metadata.

CREATE TABLE operational.media_assets (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,

  -- Provider-agnostic metadata for application use.
  storage_provider TEXT NOT NULL, -- e.g., 'cloudinary', 's3'
  storage_key TEXT NOT NULL, -- Provider-specific identifier (e.g., Cloudinary public_id, S3 object key)

  -- Media metadata
  -- Cached CDN URL for convenience. Source of truth is storage_key.
  -- Regenerate from storage_key if provider URL structure changes.
  url TEXT NOT NULL, -- CDN-delivered URL (safe for frontend use)
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT,
  width INT,
  height INT,
  checksum TEXT, -- optional SHA-256 or similar, useful for deduplication

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Media assets are immutable after upload.
  -- To replace media, soft-delete and upload a new asset.
  -- No updated_at column intentionally.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_media_assets_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object')
);

-- Indexes
CREATE INDEX idx_media_assets_store_created
  ON operational.media_assets (store_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX ux_media_assets_provider_key_active
  ON operational.media_assets (storage_provider, storage_key)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_media_assets_checksum
  ON operational.media_assets (store_id, checksum)
  WHERE deleted_at IS NULL AND checksum IS NOT NULL;

-- RLS
ALTER TABLE operational.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.media_assets FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_media_assets_select ON operational.media_assets
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_media_assets_ins ON operational.media_assets
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
DROP TABLE IF EXISTS operational.media_assets;
      `,
    )
    .execute(db);
}
