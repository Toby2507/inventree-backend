import { Module } from '@nestjs/common';
import { OutboxKyselyRepository } from './persistence/outbox.kysely.repository';
import { OUTBOX_SERVICE } from './ports/outbox.port';
import { OUTBOX_REPOSITORY } from './ports/repository.port';
import { OutboxService } from './services/outbox.service';

@Module({
  providers: [
    { provide: OUTBOX_SERVICE, useClass: OutboxService },
    { provide: OUTBOX_REPOSITORY, useClass: OutboxKyselyRepository },
  ],
  exports: [OUTBOX_SERVICE, OUTBOX_REPOSITORY],
})
export class OutboxModule {}
