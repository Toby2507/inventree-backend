import { LOGGER, type Logger } from '@app/core/observability';
import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  CLEANUP_EXPIRED_TOKENS,
  type CleanupExpiredActionTokens,
} from '../../application/ports/cleanup-expired-action-tokens.port';

@Injectable()
export class ActionTokenCleanupScheduler {
  private readonly logger;

  constructor(
    @Inject(LOGGER) logger: Logger,
    @Inject(CLEANUP_EXPIRED_TOKENS) private readonly cleanup: CleanupExpiredActionTokens,
  ) {
    this.logger = logger.forContext(ActionTokenCleanupScheduler.name);
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'action-token:cleanup' })
  async handleCleanup(): Promise<void> {
    const deletedCount = await this.cleanup.execute();
    this.logger.log(`Action token cleanup completed. Deleted ${deletedCount} expired tokens.`);
  }
}
