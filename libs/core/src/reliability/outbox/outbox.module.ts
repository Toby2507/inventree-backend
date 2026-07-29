import { Module } from '@nestjs/common';
import { OutboxKyselyRepository } from './persistence/outbox.kysely.repository';
import { OUTBOX_PUBLISHER } from './ports/outbox.port';
import { OUTBOX_REPOSITORY } from './ports/repository.port';
import { OutboxPublishingService } from './services/outbox-publishing.service';

@Module({
  providers: [
    { provide: OUTBOX_PUBLISHER, useClass: OutboxPublishingService },
    { provide: OUTBOX_REPOSITORY, useClass: OutboxKyselyRepository },
  ],
  exports: [OUTBOX_PUBLISHER, OUTBOX_REPOSITORY],
})
export class OutboxModule {}
