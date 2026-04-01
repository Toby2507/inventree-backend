import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { AnalyticsDB, OperationalDB } from './db.schema.types';

@Injectable()
export class DatabaseService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseService.name);
  private _operational!: Kysely<OperationalDB>;
  private _analytics!: Kysely<AnalyticsDB>;

  async onApplicationBootstrap(): Promise<void> {
    this._operational = new Kysely<OperationalDB>({
      dialect: new PostgresDialect({
        pool: new Pool({
          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT) || 5432,
          database: process.env.DB_NAME,
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          max: 20, // handles concurrent API requests
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 5_000,
        }),
      }),
    });
    this._analytics = new Kysely<AnalyticsDB>({
      dialect: new PostgresDialect({
        pool: new Pool({
          host: process.env.ANALYTICS_DB_HOST,
          port: Number(process.env.ANALYTICS_DB_PORT) || 5432,
          database: process.env.ANALYTICS_DB_NAME,
          user: process.env.ANALYTICS_DB_USER,
          password: process.env.ANALYTICS_DB_PASSWORD,
          max: 5, // fewer connections — queries are long-running
          idleTimeoutMillis: 60_000, // longer idle timeout for slow queries
          connectionTimeoutMillis: 10_000,
        }),
      }),
    });

    await this.verifyConnections();
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all([this._operational.destroy(), this._analytics.destroy()]);
    this.logger.log('Database connection pools closed');
  }

  private async verifyConnections(): Promise<void> {
    try {
      await this._operational.selectNoFrom((eb) => [eb.val(1).as('one')]).execute();
      this.logger.log('Operational database connection established');
    } catch (error) {
      this.logger.error('Failed to connect to operational database', error);
      throw error;
    }

    try {
      await this._analytics.selectNoFrom((eb) => [eb.val(1).as('one')]).execute();
      this.logger.log('Analytics database connection established');
    } catch (error) {
      this.logger.error('Failed to connect to analytics database', error);
      throw error;
    }
  }

  get operational(): Kysely<OperationalDB> {
    if (!this._operational) throw new Error('Operational database not initialised');
    return this._operational;
  }

  get analytics(): Kysely<AnalyticsDB> {
    if (!this._analytics) throw new Error('Analytics database not initialised');
    return this._analytics;
  }
}
