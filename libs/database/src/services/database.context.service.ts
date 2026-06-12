import { DomainEvent } from '@app/common/bases';
import { OUTBOX_SERVICE, OutboxServicePort } from '@app/core/reliability/outbox';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { sql } from 'kysely';
import {
  CommandDbContext,
  DatabaseContextPort,
  QueryDbContext,
} from '../context/database.context.types';
import { storeContextStorage } from '../context/store-context';
import { DatabaseProvider } from '../database.provider';

@Injectable()
export class DatabaseContextService implements DatabaseContextPort {
  constructor(
    @Inject(OUTBOX_SERVICE) private readonly outbox: OutboxServicePort,
    private readonly provider: DatabaseProvider,
  ) {}

  async command<T>(operation: (ctx: CommandDbContext) => Promise<T>): Promise<T> {
    const context = storeContextStorage.getStore();
    if (!context?.storeId) throw new UnauthorizedException('No store context found on request');
    return this.provider.operationalWrite.transaction().execute(async (trx) => {
      await sql`SELECT set_config( 'app.current_store_id', ${context.storeId}, true )`.execute(trx);
      const events: DomainEvent[] = [];
      const result = await operation({
        analytics: this.provider.analyticsWrite,
        operational: trx,
        events: events,
      });
      if (events.length > 0) await this.outbox.publishAll(trx, events);
      return result;
    });
  }

  async platformCommand<T>(operation: (ctx: CommandDbContext) => Promise<T>): Promise<T> {
    return this.provider.operationalWrite.transaction().execute(async (trx) => {
      const events: DomainEvent[] = [];
      const result = await operation({
        analytics: this.provider.analyticsWrite,
        operational: trx,
        events: events,
      });
      if (events.length > 0) await this.outbox.publishAll(trx, events);
      return result;
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
