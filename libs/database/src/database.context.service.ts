import { Injectable, UnauthorizedException } from '@nestjs/common';
import { sql } from 'kysely';
import { CommandDbContext, DatabaseContextPort, QueryDbContext } from './database.context.types';
import { DatabaseProvider } from './database.provider';
import { storeContextStorage } from './store-context';

@Injectable()
export class DatabaseContextService implements DatabaseContextPort {
  constructor(private readonly provider: DatabaseProvider) {}

  async command<T>(operation: (ctx: CommandDbContext) => Promise<T>): Promise<T> {
    const context = storeContextStorage.getStore();
    if (!context?.storeId) throw new UnauthorizedException('No store context found on request');
    return this.provider.operationalWrite.transaction().execute(async (trx) => {
      await sql`SELECT set_config( 'app.current_store_id', ${context.storeId}, true )`.execute(trx);
      return operation({
        analytics: this.provider.analyticsWrite,
        operational: trx,
      });
    });
  }

  async platformCommand<T>(operation: (ctx: CommandDbContext) => Promise<T>): Promise<T> {
    return this.provider.operationalWrite.transaction().execute(async (trx) => {
      return operation({
        analytics: this.provider.analyticsWrite,
        operational: trx,
      });
    });
  }

  async query<T>(operation: (ctx: QueryDbContext) => Promise<T>): Promise<T> {
    const context = storeContextStorage.getStore();
    if (!context?.storeId) throw new UnauthorizedException('No store context found on request');
    return this.provider.operationalRead
      .transaction()
      .setAccessMode('read only')
      .execute(async (trx) => {
        await sql`SELECT set_config( 'app.current_store_id', ${context.storeId}, true )`.execute(
          trx,
        );
        return operation({
          analytics: this.provider.analyticsRead,
          operational: trx,
        });
      });
  }

  async platformQuery<T>(operation: (ctx: QueryDbContext) => Promise<T>): Promise<T> {
    return operation({
      analytics: this.provider.analyticsRead,
      operational: this.provider.operationalRead,
    });
  }
}
