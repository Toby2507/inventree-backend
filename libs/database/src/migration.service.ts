import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Migration, MigrationProvider, Migrator } from 'kysely';
import { DatabaseService } from './database.service';
import { migrations } from './migrations';

export class StaticMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return migrations;
  }
}

@Injectable()
export class MigrationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MigrationService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.migrateToLatest();
  }

  async migrateToLatest(): Promise<void> {
    const migrator = this.buildMigrator();
    const { error, results } = await migrator.migrateToLatest();

    results?.forEach((result) => {
      if (result.status === 'Success') {
        this.logger.log(`Migration applied: ${result.migrationName}`);
      } else if (result.status === 'Error') {
        this.logger.error(`Migration failed: ${result.migrationName}`);
      } else if (result.status === 'NotExecuted') {
        this.logger.warn(`Migration skipped: ${result.migrationName}`);
      }
    });

    if (error) {
      this.logger.error('Migration run failed', error);
      throw error;
    }
    if (!results?.length) this.logger.log('Database schema is up to date');
  }

  async migrateDown(): Promise<void> {
    const migrator = this.buildMigrator();
    const { error, results } = await migrator.migrateDown();

    results?.forEach((result) => {
      if (result.status === 'Success') {
        this.logger.log(`Migration rolled back: ${result.migrationName}`);
      } else if (result.status === 'Error') {
        this.logger.error(`Rollback failed: ${result.migrationName}`);
      }
    });

    if (error) {
      this.logger.error('Migration rollback failed', error);
      throw error;
    }
  }

  private buildMigrator(): Migrator {
    return new Migrator({
      db: this.databaseService.operational,
      provider: new StaticMigrationProvider(),
    });
  }
}
