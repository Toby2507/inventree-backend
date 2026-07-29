import type { OperationalDB } from '@app/database';
import type { DomainEvent } from '@app/shared-kernel';

export interface OutboxPublisher {
  publishAll(db: OperationalDB, events: DomainEvent[]): Promise<void>;
}

export const OUTBOX_PUBLISHER = Symbol('OUTBOX_PUBLISHER');
