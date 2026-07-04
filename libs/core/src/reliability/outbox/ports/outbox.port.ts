import { OperationalDB } from '@app/database';
import { DomainEvent } from '@app/shared-kernel';

export interface OutboxServicePort {
  publishAll(db: OperationalDB, events: DomainEvent[]): Promise<void>;
}

export const OUTBOX_SERVICE = Symbol('OUTBOX_SERVICE');
