import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { TenantDatabaseService } from './tenant-database.service';

@Global()
@Module({
  providers: [DatabaseService, TenantDatabaseService],
  exports: [DatabaseService, TenantDatabaseService],
})
export class DatabaseModule {}
