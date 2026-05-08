import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool, PoolConfig } from 'pg';
import { AnalyticsDB, OperationalDB } from './db.schema.types';

@Injectable()
export class DatabaseProvider implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseProvider.name);
  private _operationalPrimary!: Kysely<OperationalDB>;
  private _operationalReplica!: Kysely<OperationalDB>;
  private _analyticsPrimary!: Kysely<AnalyticsDB>;

  private _analyticsRead!: Kysely<AnalyticsDB>;
  private _analyticsWrite!: Kysely<AnalyticsDB>;
  private _operationalRead!: Kysely<OperationalDB>;
  private _operationalWrite!: Kysely<OperationalDB>;

  async onApplicationBootstrap(): Promise<void> {
    this._operationalPrimary = this.createDbInstance({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    /**
     * Read replica placeholder.
     * Currently points to primary until replicas are introduced.
     */
    this._operationalReplica = this._operationalPrimary;
    /**
     * Separate analytics pool configuration.
     * Can later be moved to a dedicated analytics database.
     */
    this._analyticsPrimary = this.createDbInstance({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      max: 5,
      idleTimeoutMillis: 60_000,
      connectionTimeoutMillis: 10_000,
    });

    await this.verifyConnections();
    this._analyticsRead = this._analyticsPrimary.withSchema('analytics');
    this._analyticsWrite = this._analyticsPrimary.withSchema('analytics');
    this._operationalRead = this._operationalReplica.withSchema('operational');
    this._operationalWrite = this._operationalPrimary.withSchema('operational');
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all([
      this.destroyDbInstance(this._operationalPrimary, 'operational'),
      this.destroyDbInstance(this._analyticsPrimary, 'analytics'),
    ]);
  }

  private createDbInstance<T>(config: PoolConfig): Kysely<T> {
    return new Kysely<T>({
      dialect: new PostgresDialect({
        pool: new Pool(config),
      }),
    });
  }

  private async destroyDbInstance(db: Kysely<any>, name: string): Promise<void> {
    await db.destroy();
    this.logger.log(`Closed ${name} database pools`);
  }

  private async verifyConnections(): Promise<void> {
    await this.verifyConnection(this._operationalPrimary, 'operational');
    await this.verifyConnection(this._analyticsPrimary, 'analytics');
  }

  private async verifyConnection(db: Kysely<any>, name: string): Promise<void> {
    try {
      await db.selectNoFrom((eb) => [eb.val(1).as('one')]).executeTakeFirst();
      this.logger.log(`Connected to ${name} database successfully`);
    } catch (error) {
      this.logger.error(
        `Failed to connect to ${name} database`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  get forBootstrapMigration(): Kysely<OperationalDB> {
    if (!this._operationalPrimary) throw new Error('Operational database not initialised');
    return this._operationalPrimary;
  }

  get forOperationalMigration(): Kysely<OperationalDB> {
    if (!this._operationalPrimary) throw new Error('Operational database not initialised');
    return this._operationalPrimary;
  }

  get forAnalyticsMigration(): Kysely<AnalyticsDB> {
    if (!this._analyticsPrimary) throw new Error('Analytics database not initialised');
    return this._analyticsPrimary;
  }

  get analyticsRead(): Kysely<AnalyticsDB> {
    if (!this._analyticsRead) throw new Error('Analytics database not initialised');
    return this._analyticsRead;
  }

  get analyticsWrite(): Kysely<AnalyticsDB> {
    if (!this._analyticsWrite) throw new Error('Analytics database not initialised');
    return this._analyticsWrite;
  }

  get operationalRead(): Kysely<OperationalDB> {
    if (!this._operationalRead) throw new Error('Operational database not initialised');
    return this._operationalRead;
  }

  get operationalWrite(): Kysely<OperationalDB> {
    if (!this._operationalWrite) throw new Error('Operational database not initialised');
    return this._operationalWrite;
  }
}
