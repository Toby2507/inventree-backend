import { OperationalDB } from '@app/database';
import { CreateOutboxEvent } from '../types/outbox.interface';

export interface OutboxRepository {
  insert(db: OperationalDB, record: CreateOutboxEvent): Promise<void>;
}

export const OUTBOX_REPOSITORY = Symbol('OUTBOX_REPOSITORY');
