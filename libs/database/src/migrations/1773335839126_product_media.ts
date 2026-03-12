import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Associates media assets with store products.
-- Supports multiple media per product, ordering, and primary image designation.

CREATE TABLE operational.product_media (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES operational.products(id) ON DELETE CASCADE,
  media_asset_id UUID NOT NULL REFERENCES operational.media_assets(id) ON DELETE RESTRICT,
  created_by_store_member_id UUID REFERENCES operational.store_members(id) ON DELETE SET NULL,

  sort_order INT, -- sort using ASC NULLS LAST to keep nulls at the end;
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  alt_text TEXT,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_product_images_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object')
);

-- Indexes
-- Prevent duplicate association
CREATE UNIQUE INDEX ux_product_images_unique_active
  ON operational.product_media (product_id, media_asset_id)
  WHERE deleted_at IS NULL;

-- Only one primary image per product
CREATE UNIQUE INDEX ux_product_images_primary_active
  ON operational.product_media (product_id)
  WHERE deleted_at IS NULL AND is_primary = TRUE;

CREATE INDEX idx_product_images_product
  ON operational.product_media (product_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_product_images_media
  ON operational.product_media (media_asset_id)
  WHERE deleted_at IS NULL;

-- Triggers
CREATE TRIGGER trg_set_product_media_updated_at
BEFORE UPDATE ON operational.product_media
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS: (tenant-scoped)
ALTER TABLE operational.product_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.product_media FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_product_images_select ON operational.product_media
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_product_images_ins ON operational.product_media
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
DROP TABLE IF EXISTS operational.product_media;
      `,
    )
    .execute(db);
}
