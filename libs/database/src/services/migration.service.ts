import { LOGGER, LoggerPort } from '@app/core/observability';
import { Inject, Injectable } from '@nestjs/common';
import { Migration, MigrationProvider, Migrator } from 'kysely';
import { analyticsMigrations, bootstrapMigrations, operationalMigrations } from '../migrations';
import { DATABASE_PROVIDER, DatabaseProviderPort } from '../ports/provider.port';

type MigrationTarget = 'analytics' | 'bootstrap' | 'operational';

class StaticMigrationProvider implements MigrationProvider {
  constructor(private readonly migrations: Record<string, Migration>) {}

  async getMigrations(): Promise<Record<string, Migration>> {
    return this.migrations;
  }
}

@Injectable()
export class MigrationService {
  private readonly logger;

  constructor(
    @Inject(LOGGER) logger: LoggerPort,
    @Inject(DATABASE_PROVIDER) private readonly provider: DatabaseProviderPort,
  ) {
    this.logger = logger.forContext(MigrationService.name);
  }

  async migrateAllToLatest(): Promise<void> {
    await this.migrateToLatest('bootstrap');
    await this.migrateToLatest('operational');
    await this.migrateToLatest('analytics');
  }

  async migrateToLatest(target: MigrationTarget): Promise<void> {
    const migrator = this.buildMigrator(target);
    const { error, results } = await migrator.migrateToLatest();

    results?.forEach((result) => {
      if (result.status === 'Success') {
        this.logger.log(`[${target}] Migration applied: ${result.migrationName}`);
      } else if (result.status === 'Error') {
        this.logger.error(`[${target}] Migration failed: ${result.migrationName}`);
      } else if (result.status === 'NotExecuted') {
        this.logger.warn(`[${target}] Migration skipped: ${result.migrationName}`);
      }
    });

    if (error) {
      this.logger.error(`[${target}] Migration run failed`, { error });
      throw error;
    }
    if (!results?.length) this.logger.log(`[${target}] Database schema is up to date`);
  }

  async migrateDown(target: MigrationTarget): Promise<void> {
    if (target === 'bootstrap') {
      this.logger.warn('Rollback of bootstrap migrations is not supported');
      throw new Error('Rollback of bootstrap migrations is not supported');
    }
    const migrator = this.buildMigrator(target);
    const { error, results } = await migrator.migrateDown();

    results?.forEach((result) => {
      if (result.status === 'Success') {
        this.logger.log(`[${target}] Migration rolled back: ${result.migrationName}`);
      } else if (result.status === 'Error') {
        this.logger.error(`[${target}] Rollback failed: ${result.migrationName}`);
      }
    });

    if (error) {
      this.logger.error(`[${target}] Migration rollback failed`, { error });
      throw error;
    }
  }

  private buildMigrator(target: MigrationTarget): Migrator {
    let db;
    let migrations: Record<string, Migration>;

    if (target === 'bootstrap') {
      db = this.provider.forBootstrapMigration;
      migrations = bootstrapMigrations;
    } else if (target === 'operational') {
      db = this.provider.forOperationalMigration;
      migrations = operationalMigrations;
    } else {
      db = this.provider.forAnalyticsMigration;
      migrations = analyticsMigrations;
    }

    return new Migrator({
      db,
      provider: new StaticMigrationProvider(migrations),
      migrationTableName: `kysely_migration_${target}`,
    });
  }
}
