import { Module } from '@nestjs/common';
import { DatabaseModule } from './database.module';
import { MigrationService } from './migration.service';

@Module({
  imports: [DatabaseModule],
  providers: [MigrationService],
  exports: [MigrationService],
})
export class MigrationModule {}
