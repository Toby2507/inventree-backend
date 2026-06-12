import { DomainEvent } from '@app/common/bases';
import { OperationalDB } from '@app/database';

export interface OutboxServicePort {
  publishAll(db: OperationalDB, events: DomainEvent[]): Promise<void>;
}

export const OUTBOX_SERVICE = Symbol('OUTBOX_SERVICE');
