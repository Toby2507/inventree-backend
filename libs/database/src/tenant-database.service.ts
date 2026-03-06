import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { Kysely, sql, Transaction } from 'kysely';
import { AnalyticsDB, OperationalDB } from './db.types';
import { storeContextStorage } from './store-context';

@Injectable()
export class TenantDatabaseService {
  constructor(private readonly databaseService: DatabaseService) {}

  async runInTenantContext<T>(
    operation: (trx: Transaction<OperationalDB>) => Promise<T>,
  ): Promise<T> {
    const context = storeContextStorage.getStore();
    if (!context?.storeId) throw new UnauthorizedException('No store context found on request');
    return this.databaseService.operational.transaction().execute(async (trx) => {
      await sql`SELECT set_config('app.current_store_id', ${context.storeId}, true)`.execute(trx);
      return operation(trx);
    });
  }

  async runAsSystem<T>(operation: (trx: Transaction<OperationalDB>) => Promise<T>): Promise<T> {
    return this.databaseService.operational.transaction().execute(operation);
  }

  get operational(): Kysely<OperationalDB> {
    return this.databaseService.operational;
  }

  get analytics(): Kysely<AnalyticsDB> {
    return this.databaseService.analytics;
  }
}
