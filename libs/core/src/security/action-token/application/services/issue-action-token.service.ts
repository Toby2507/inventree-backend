import { ID_GENERATOR, type IDGenerator } from '@app/core/generators';
import { CRYPTOGRAPHY, type Cryptography } from '@app/core/security/cryptography';
import type { OperationalDB } from '@app/database';
import { CLOCK, type Clock } from '@app/shared-kernel';
import { Inject, Injectable } from '@nestjs/common';
import { type ActionTokenRepository, TOKEN_REPOSITORY } from '../../domain/action-token.repository';
import { ActionToken } from '../../domain/aggregates/action-token.aggregate';
import { ACTION_TOKEN_REVOKE_REASONS } from '../../domain/aggregates/action-token.types';
import {
  type ActionTokenPolicyRegistry,
  POLICY_REGISTRY,
} from '../../domain/policies/action-token-policy.registry';
import type {
  IssueActionToken,
  IssueActionTokenCommand,
  IssuedActionToken,
} from '../ports/issue-action-token.port';

@Injectable()
export class IssueActionTokenService implements IssueActionToken {
  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(CRYPTOGRAPHY) private readonly crypto: Cryptography,
    @Inject(ID_GENERATOR) private readonly idGenerator: IDGenerator,
    @Inject(POLICY_REGISTRY) private readonly policyRegistry: ActionTokenPolicyRegistry,
    @Inject(TOKEN_REPOSITORY) private readonly repository: ActionTokenRepository,
  ) {}

  async execute(db: OperationalDB, command: IssueActionTokenCommand): Promise<IssuedActionToken> {
    const policy = this.policyRegistry.resolve(command.purpose);
    if (policy.singleActiveInstance) await this.revokeExistingTokens(db, command);
    const id = this.idGenerator.generateUUIDV7();
    const token = this.crypto.randomToken();
    const tokenHash = this.crypto.sha256(token);
    const expiresAt = this.clock.now().plus(policy.ttl);
    const actionToken = ActionToken.create({
      id,
      userId: command.userId,
      purpose: command.purpose,
      tokenHash,
      expiresAt,
      createdAt: this.clock.now(),
    });
    await this.repository.create(db, actionToken);
    return { token, expiresAt, expiresIn: policy.ttl };
  }

  private async revokeExistingTokens(
    db: OperationalDB,
    command: IssueActionTokenCommand,
  ): Promise<void> {
    const existingUsableTokens = await this.repository.findUsableByUserAndPurpose(
      db,
      command.userId,
      command.purpose,
      this.clock.now(),
    );
    if (!existingUsableTokens.length) return;
    const reason = ACTION_TOKEN_REVOKE_REASONS.SUPERSEDED;
    const tokenIds = existingUsableTokens.map((t) => t.id.value);
    for (const token of existingUsableTokens) token.revoke(reason, this.clock.now());
    await this.repository.revokeUsableByIds(db, tokenIds, reason, this.clock.now());
  }
}
