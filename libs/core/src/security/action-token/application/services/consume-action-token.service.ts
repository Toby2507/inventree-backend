import { type Cryptography, CRYPTOGRAPHY } from '@app/core/security/cryptography';
import type { OperationalDB } from '@app/database';
import { type Clock, CLOCK } from '@app/shared-kernel';
import { Inject, Injectable } from '@nestjs/common';
import { type ActionTokenRepository, TOKEN_REPOSITORY } from '../../domain/action-token.repository';
import type { ActionToken } from '../../domain/aggregates/action-token.aggregate';
import { TokenNotFoundException } from '../exceptions/action-token.app.exceptions';
import type { ConsumeActionToken, ConsumeActionTokenCommand } from '../ports/consume-action-token';

@Injectable()
export class ConsumeActionTokenService implements ConsumeActionToken {
  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(CRYPTOGRAPHY) private readonly crypto: Cryptography,
    @Inject(TOKEN_REPOSITORY) private readonly repository: ActionTokenRepository,
  ) {}

  async execute(db: OperationalDB, command: ConsumeActionTokenCommand): Promise<ActionToken> {
    const hash = this.crypto.sha256(command.token);
    const actionToken = await this.repository.findByHash(db, hash);
    if (!actionToken) throw new TokenNotFoundException();
    actionToken.consume(command.purpose, this.clock.now());
    await this.repository.update(db, actionToken);
    return actionToken;
  }
}
