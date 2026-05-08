import { Global, Module } from '@nestjs/common';
import { DatabaseContextService } from './database.context.service';
import { DatabaseProvider } from './database.provider';

@Global()
@Module({
  providers: [DatabaseProvider, DatabaseContextService],
  exports: [DatabaseProvider, DatabaseContextService],
})
export class DatabaseModule {}
