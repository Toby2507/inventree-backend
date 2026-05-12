import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- Receipt configuration per store (header/footer, branding, receipt behaviors).
-- One row per store.

CREATE TABLE operational.store_receipt_settings (
  store_id UUID PRIMARY KEY REFERENCES operational.stores(id) ON DELETE CASCADE,

  receipt_title TEXT NOT NULL,              -- e.g., store trading name; defaults to store name in app
  header_lines TEXT[],             -- optional extra header lines
  footer_lines TEXT[],             -- optional extra footer lines (returns policy, thank you note, etc.)

  show_store_address BOOLEAN NOT NULL DEFAULT TRUE,
  show_store_phone   BOOLEAN NOT NULL DEFAULT TRUE,
  show_store_email   BOOLEAN NOT NULL DEFAULT FALSE,

  show_attendant_name BOOLEAN NOT NULL DEFAULT TRUE,
  show_terminal_code  BOOLEAN NOT NULL DEFAULT TRUE,

  show_tax_breakdown  BOOLEAN NOT NULL DEFAULT TRUE,
  show_discounts      BOOLEAN NOT NULL DEFAULT TRUE,

  receipt_extra JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g., custom fields, QR payload config, etc.

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,

  CONSTRAINT chk_receipt_extra_object
    CHECK (jsonb_typeof(receipt_extra) = 'object')
);

CREATE TRIGGER trg_store_receipt_settings_set_updated_at
BEFORE UPDATE ON operational.store_receipt_settings
FOR EACH ROW
EXECUTE FUNCTION operational.set_updated_at();

-- RLS (tenant-scoped)
ALTER TABLE operational.store_receipt_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational.store_receipt_settings FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_store_receipt_settings ON operational.store_receipt_settings
  USING (store_id = current_setting('app.current_store_id', true)::UUID);

CREATE POLICY tenant_isolation_store_receipt_settings_ins ON operational.store_receipt_settings
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
DROP TABLE IF EXISTS operational.store_receipt_settings;
      `,
    )
    .execute(db);
}
