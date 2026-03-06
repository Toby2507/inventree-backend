import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { TenantDatabaseService } from './tenant-database.service';
import { MigrationService } from './migration.service';

@Global()
@Module({
  providers: [DatabaseService, MigrationService, TenantDatabaseService],
  exports: [DatabaseService, TenantDatabaseService],
})
export class DatabaseModule {}
