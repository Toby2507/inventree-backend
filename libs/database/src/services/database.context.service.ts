import { DomainEvent } from '@app/common/bases';
import { OUTBOX_SERVICE, OutboxServicePort } from '@app/core/reliability/outbox';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { sql } from 'kysely';
import { storeContextStorage } from '../context/store-context';
import { CommandDbContext, DatabaseContextPort, QueryDbContext } from '../ports/context.port';
import { DATABASE_PROVIDER, DatabaseProviderPort } from '../ports/provider.port';

@Injectable()
export class DatabaseContextService implements DatabaseContextPort {
  constructor(
    @Inject(OUTBOX_SERVICE) private readonly outbox: OutboxServicePort,
    @Inject(DATABASE_PROVIDER) private readonly provider: DatabaseProviderPort,
  ) {}

  async command<T>(operation: (ctx: CommandDbContext) => Promise<T>): Promise<T> {
    const context = storeContextStorage.getStore();
    if (!context?.storeId) throw new UnauthorizedException('No store context found on request');
    return this.provider.operationalWrite.transaction().execute(async (trx) => {
      await sql`SELECT set_config( 'app.current_store_id', ${context.storeId}, true )`.execute(trx);
      const { emit, events } = this.eventHandler();
      const result = await operation({
        analytics: this.provider.analyticsWrite,
        operational: trx,
        events: { emit },
      });
      if (events.length > 0) await this.outbox.publishAll(trx, events);
      return result;
    });
  }

  async platformCommand<T>(operation: (ctx: CommandDbContext) => Promise<T>): Promise<T> {
    return this.provider.operationalWrite.transaction().execute(async (trx) => {
      const { emit, events } = this.eventHandler();
      const result = await operation({
        analytics: this.provider.analyticsWrite,
        operational: trx,
        events: { emit },
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

  private eventHandler() {
    const events: DomainEvent[] = [];
    const emit = (...es: DomainEvent[]) => {
      events.push(...es);
    };
    return { events, emit };
  }
}
