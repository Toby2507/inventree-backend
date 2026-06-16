import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
-- This migration adds a trigger to notify when new outbox events are inserted.
-- This is useful for real-time processing of outbox events.

CREATE OR REPLACE FUNCTION operational.notify_outbox_pending()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('outbox_pending', NEW.id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_outbox_pending
AFTER INSERT ON operational.outbox_events
FOR EACH ROW
EXECUTE FUNCTION operational.notify_outbox_pending();
      `,
    )
    .execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `
DROP TRIGGER IF EXISTS trg_notify_outbox_pending ON operational.outbox_events;
DROP FUNCTION IF EXISTS operational.notify_outbox_pending;
      `,
    )
    .execute(db);
}
