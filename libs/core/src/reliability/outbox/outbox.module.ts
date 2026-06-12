import { Module } from '@nestjs/common';
import { OutboxKyselyRepository } from './persistence/outbox.kysely.repository';
import { OUTBOX_REPOSITORY } from './persistence/outbox.repository.port';
import { OutboxService } from './services/outbox.service';
import { OUTBOX_SERVICE } from './types/outbox.port';

@Module({
  providers: [
    { provide: OUTBOX_SERVICE, useClass: OutboxService },
    { provide: OUTBOX_REPOSITORY, useClass: OutboxKyselyRepository },
  ],
  exports: [OUTBOX_SERVICE],
})
export class OutboxModule {}
