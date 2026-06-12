import { OutboxModule } from '@app/core/reliability/outbox';
import { Global, Module } from '@nestjs/common';
import { DATABASE_CONTEXT } from '../context/database.context.types';
import { DatabaseProvider } from '../database.provider';
import { DatabaseContextService } from '../services/database.context.service';

@Global()
@Module({
  imports: [OutboxModule],
  providers: [DatabaseProvider, { provide: DATABASE_CONTEXT, useClass: DatabaseContextService }],
  exports: [DatabaseProvider, DATABASE_CONTEXT],
})
export class DatabaseModule {}
