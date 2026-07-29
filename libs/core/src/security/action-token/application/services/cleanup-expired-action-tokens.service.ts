import { DATABASE_CONTEXT, type DatabaseContext } from '@app/database';
import { type Clock, CLOCK } from '@app/shared-kernel';
import { Inject, Injectable } from '@nestjs/common';
import { type ActionTokenRepository, TOKEN_REPOSITORY } from '../../domain/action-token.repository';
import {
  type ActionTokenConfig,
  TOKEN_CONFIG,
} from '../../infrastructure/config/action-token.config';
import type { CleanupExpiredActionTokens } from '../ports/cleanup-expired-action-tokens.port';

@Injectable()
export class CleanupExpiredActionTokensService implements CleanupExpiredActionTokens {
  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(TOKEN_CONFIG) private readonly config: ActionTokenConfig,
    @Inject(DATABASE_CONTEXT) private readonly db: DatabaseContext,
    @Inject(TOKEN_REPOSITORY) private readonly repository: ActionTokenRepository,
  ) {}

  async execute(): Promise<number> {
    return this.db.platformCommand(async (ctx) => {
      const cutoff = this.clock.now().minus(this.config.retentionPeriod);
      let totalDeleted = 0;
      let deletedInBatch: number;
      do {
        deletedInBatch = await this.repository.deleteExpired(
          ctx.operational,
          cutoff,
          this.config.cleanupBatchSize,
        );
        totalDeleted += deletedInBatch;
      } while (deletedInBatch === this.config.cleanupBatchSize);
      return totalDeleted;
    });
  }
}
