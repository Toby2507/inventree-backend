import { OutboxModule } from '@app/core/reliability/outbox';
import { Global, Module } from '@nestjs/common';
import { DatabaseProvider } from '../database.provider';
import { DATABASE_CONTEXT } from '../ports/context.port';
import { DATABASE_PROVIDER } from '../ports/provider.port';
import { DatabaseContextService } from '../services/database.context.service';

@Global()
@Module({
  imports: [OutboxModule],
  providers: [
    { provide: DATABASE_PROVIDER, useClass: DatabaseProvider },
    { provide: DATABASE_CONTEXT, useClass: DatabaseContextService },
  ],
  exports: [DATABASE_PROVIDER, DATABASE_CONTEXT],
})
export class DatabaseModule {}
