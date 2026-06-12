import { DomainEvent } from '@app/common/bases';
import { getOptionalObservationContext, serializeOutboxContext } from '@app/core/observability';
import { OperationalDB } from '@app/database';
import { Inject, Injectable } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import { OutboxServicePort } from '../types/outbox.port';
import { OUTBOX_REPOSITORY, OutboxRepository } from '../persistence/outbox.repository.port';

@Injectable()
export class OutboxService implements OutboxServicePort {
  constructor(@Inject(OUTBOX_REPOSITORY) private readonly repository: OutboxRepository) {}

  async publishAll(db: OperationalDB, events: DomainEvent[]): Promise<void> {
    if (!events.length) return;
    const ctx = getOptionalObservationContext();
    const serializedObs = ctx ? serializeOutboxContext(ctx) : undefined;
    const context = trace.getActiveSpan()?.spanContext();
    const record = {
      events,
      ctx: { serialized: serializedObs, traceId: context?.traceId, spanId: context?.spanId },
    };
    await this.repository.insert(db, record);
  }
}
