import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Kysely, PostgresDialect } from 'kysely';
import { Client, Pool, PoolConfig } from 'pg';
import { DatabaseProviderPort } from './ports/provider.port';
import { AnalyticsDB, OperationalDB } from './types/db.schema.types';

@Injectable()
export class DatabaseProvider
  implements OnApplicationBootstrap, OnApplicationShutdown, DatabaseProviderPort
{
  private readonly logger = new Logger(DatabaseProvider.name);
  private _operationalPrimary!: OperationalDB;
  private _operationalReplica!: OperationalDB;
  private _analyticsPrimary!: AnalyticsDB;

  private _analyticsRead!: AnalyticsDB;
  private _analyticsWrite!: AnalyticsDB;
  private _operationalRead!: OperationalDB;
  private _operationalWrite!: OperationalDB;

  private _notificationClient!: Client;

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
    /**
     * Notification client for LISTEN/NOTIFY events.
     */
    this._notificationClient = new Client({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: Number(process.env.DB_PORT) || 5432,
    });

    await this.verifyConnections();
    this._analyticsRead = this._analyticsPrimary.withSchema('analytics');
    this._analyticsWrite = this._analyticsPrimary.withSchema('analytics');
    this._operationalRead = this._operationalReplica.withSchema('operational');
    this._operationalWrite = this._operationalPrimary.withSchema('operational');
    await this.connectNotificationClient();
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all([
      this.destroyDbInstance(this._operationalPrimary, 'operational'),
      this.destroyDbInstance(this._analyticsPrimary, 'analytics'),
      this.disconnectNotificationClient(),
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

  private async connectNotificationClient(): Promise<void> {
    try {
      await this._notificationClient.connect();
      this.logger.log('Notification client connected');
      this._notificationClient.on('error', (err) => {
        this.logger.error('Notification client error', err.message);
      });
    } catch (error) {
      this.logger.error(
        'Failed to connect notification client',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  private async disconnectNotificationClient(): Promise<void> {
    try {
      await this._notificationClient.end();
      this.logger.log('Notification client disconnected');
    } catch (error) {
      this.logger.error(
        'Error disconnecting notification client',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  get forBootstrapMigration(): OperationalDB {
    if (!this._operationalPrimary) throw new Error('Operational database not initialised');
    return this._operationalPrimary;
  }

  get forOperationalMigration(): OperationalDB {
    if (!this._operationalPrimary) throw new Error('Operational database not initialised');
    return this._operationalPrimary;
  }

  get forAnalyticsMigration(): AnalyticsDB {
    if (!this._analyticsPrimary) throw new Error('Analytics database not initialised');
    return this._analyticsPrimary;
  }

  get analyticsRead(): AnalyticsDB {
    if (!this._analyticsRead) throw new Error('Analytics database not initialised');
    return this._analyticsRead;
  }

  get analyticsWrite(): AnalyticsDB {
    if (!this._analyticsWrite) throw new Error('Analytics database not initialised');
    return this._analyticsWrite;
  }

  get operationalRead(): OperationalDB {
    if (!this._operationalRead) throw new Error('Operational database not initialised');
    return this._operationalRead;
  }

  get operationalWrite(): OperationalDB {
    if (!this._operationalWrite) throw new Error('Operational database not initialised');
    return this._operationalWrite;
  }

  /**
   * The persistent pg.Client used for LISTEN/NOTIFY.
   * Call client.query('LISTEN channel') and attach a 'notification'
   * listener. Do not use this for regular queries.
   */
  get notificationClient(): Client {
    if (!this._notificationClient) throw new Error('Notification client not initialised');
    return this._notificationClient;
  }
}
