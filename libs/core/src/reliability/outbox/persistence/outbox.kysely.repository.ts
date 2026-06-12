import { OperationalDB } from '@app/database';
import { Injectable } from '@nestjs/common';
import { CreateOutboxEvent } from '../types/outbox.interface';
import { OutboxEventMapper } from './outbox.mapper';
import { OutboxRepository } from './outbox.repository.port';

@Injectable()
export class OutboxKyselyRepository implements OutboxRepository {
  private readonly mapper = new OutboxEventMapper();

  async insert(db: OperationalDB, record: CreateOutboxEvent): Promise<void> {
    const events = this.mapper.toPublish(record);
    await db.insertInto('outbox_events').values(events).execute();
  }
}
