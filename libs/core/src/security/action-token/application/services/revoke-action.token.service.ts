import type { OperationalDB } from '@app/database';
import { type Clock, CLOCK } from '@app/shared-kernel';
import { Inject, Injectable } from '@nestjs/common';
import { type ActionTokenRepository, TOKEN_REPOSITORY } from '../../domain/action-token.repository';
import type { ActionToken } from '../../domain/aggregates/action-token.aggregate';
import type { ActionTokenRevokeReason } from '../../domain/aggregates/action-token.types';
import type {
  RevokeActionToken,
  RevokeAllTokensForUserCommand,
  RevokeTokenByIdCommand,
  RevokeTokenByPurposeCommand,
} from '../ports/revoke-action-token.port';

@Injectable()
export class RevokeActionTokenService implements RevokeActionToken {
  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(TOKEN_REPOSITORY) private readonly repository: ActionTokenRepository,
  ) {}

  async allForUser(db: OperationalDB, command: RevokeAllTokensForUserCommand): Promise<void> {
    const tokens = await this.repository.findUsableByUser(db, command.userId, this.clock.now());
    await this.revokeTokens(db, tokens, command.reason);
  }

  async byId(db: OperationalDB, command: RevokeTokenByIdCommand): Promise<void> {
    const token = await this.repository.findById(db, command.tokenId.value);
    if (!token) return;
    await this.revokeTokens(db, [token], command.reason);
  }

  async byPurpose(db: OperationalDB, command: RevokeTokenByPurposeCommand): Promise<void> {
    const tokens = await this.repository.findUsableByUserAndPurpose(
      db,
      command.userId,
      command.purpose,
      this.clock.now(),
    );
    await this.revokeTokens(db, tokens, command.reason);
  }

  private async revokeTokens(
    db: OperationalDB,
    tokens: ActionToken[],
    reason: ActionTokenRevokeReason,
  ): Promise<void> {
    if (!tokens.length) return;
    const now = this.clock.now();
    for (const token of tokens) token.revoke(reason, now);
    const tokenIds = tokens.map((t) => t.id.value);
    await this.repository.revokeUsableByIds(db, tokenIds, reason, now);
  }
}
