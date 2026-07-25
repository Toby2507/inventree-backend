import { DATABASE_CONTEXT, type DatabaseContext } from '@app/database';
import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  IDEMPOTENCY_REPOSITORY,
  type IdempotencyRepository,
} from '../persistence/idempotency.port';

@Injectable()
export class IdempotencyService {
  constructor(
    @Inject(DATABASE_CONTEXT) private readonly db: DatabaseContext,
    @Inject(IDEMPOTENCY_REPOSITORY) private readonly repository: IdempotencyRepository,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async sweepStaleInProgress(): Promise<void> {
    await this.db.platformCommand((ctx) => this.repository.sweepStaleInProgress(ctx.operational));
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async deleteExpiredRecords(): Promise<void> {
    await this.db.platformCommand((ctx) => this.repository.deleteExpired(ctx.operational));
  }
}
