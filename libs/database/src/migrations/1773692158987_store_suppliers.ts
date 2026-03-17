import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Store-scoped suppliers (vendors you buy from).
-- Address is columnar for filtering/reporting later (state/city/vendor density).
-- Keep contacts optional; many SMEs just store one phone number and name.

CREATE TABLE operational.store_suppliers (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  store_id UUID NOT NULL REFERENCES operational.stores(id) ON DELETE CASCADE,
  created_by_store_member_id UUID REFERENCES operational.store_members(id) ON DELETE SET NULL,

  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,

  email TEXT,
  phone TEXT,

  tax_id TEXT,
  notes TEXT,

  -- Address (columnar; optional)
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  country_code CHAR(2),
  postal_code TEXT,

  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_store_suppliers_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object')
);

-- Indexes
CREATE INDEX idx_store_suppliers_store_id_id
  ON operational.store_suppliers (store_id, id DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX ux_store_suppliers_store_normalized_name_active
  ON operational.store_suppliers (store_id, normalized_name)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_store_suppliers_store_active
  ON operational.store_suppliers (store_id, normalized_name)
  WHERE deleted_at IS NULL AND is_active = TRUE;

-- Triggers
CREATE TRIGGER trg_set_store_suppliers_updated_at
BEFORE UPDATE ON operational.store_suppliers
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS: (tenant-scoped)
ALTER TABLE operational.store_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.store_suppliers FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_store_suppliers ON operational.store_suppliers
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_store_suppliers_ins ON operational.store_suppliers
  FOR INSERT
  WITH CHECK (store_id = current_setting('app.current_store_id', true)::UUID);

-- Circular reference resolved: products.preferred_supplier_id added after suppliers exists
-- NOTE: preferred_supplier_id must reference a supplier belonging to this store.
-- Enforced at application layer.
ALTER TABLE operational.products
  ADD COLUMN preferred_supplier_id UUID REFERENCES operational.store_suppliers(id) ON DELETE SET NULL;

CREATE INDEX idx_products_preferred_supplier
  ON operational.products (store_id, preferred_supplier_id)
  WHERE deleted_at IS NULL AND preferred_supplier_id IS NOT NULL;
      `,
    )
    .execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
DROP INDEX IF EXISTS operational.idx_products_preferred_supplier;
ALTER TABLE operational.products DROP COLUMN IF EXISTS preferred_supplier_id;
DROP TABLE IF EXISTS operational.store_suppliers;
      `,
    )
    .execute(db);
}
