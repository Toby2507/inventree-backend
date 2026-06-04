import { Global, Module } from '@nestjs/common';
import { DatabaseContextService } from '../services/database.context.service';
import { DATABASE_CONTEXT } from '../context/database.context.types';
import { DatabaseProvider } from '../database.provider';

@Global()
@Module({
  providers: [DatabaseProvider, { provide: DATABASE_CONTEXT, useClass: DatabaseContextService }],
  exports: [DatabaseProvider, DATABASE_CONTEXT],
})
export class DatabaseModule {}
