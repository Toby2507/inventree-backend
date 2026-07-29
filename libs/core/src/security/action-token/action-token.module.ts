import { Module } from '@nestjs/common';
import { CryptographyModule } from '../cryptography';
import { CLEANUP_EXPIRED_TOKENS } from './application/ports/cleanup-expired-action-tokens.port';
import { CONSUME_TOKEN } from './application/ports/consume-action-token.port';
import { ISSUE_TOKEN } from './application/ports/issue-action-token.port';
import { REVOKE_TOKEN } from './application/ports/revoke-action-token.port';
import { CleanupExpiredActionTokensService } from './application/services/cleanup-expired-action-tokens.service';
import { ConsumeActionTokenService } from './application/services/consume-action-token.service';
import { IssueActionTokenService } from './application/services/issue-action-token.service';
import { RevokeActionTokenService } from './application/services/revoke-action.token.service';
import { TOKEN_REPOSITORY } from './domain/action-token.repository';
import { POLICY_REGISTRY } from './domain/policies/action-token-policy.registry';
import { DEFAULT_ACTION_TOKEN_POLICIES } from './domain/policies/default-action-token-policies';
import {
  DEFAULT_ACTION_TOKEN_CONFIG,
  TOKEN_CONFIG,
} from './infrastructure/config/action-token.config';
import { ActionTokenKyselyRepository } from './infrastructure/persistence/action-token.kysely.repository';
import { InMemoryActionTokenPolicyRegistry } from './infrastructure/policies/action-token-policy.in-memory.registry';
import { ActionTokenCleanupScheduler } from './infrastructure/schedulers/action-token-cleanup.scheduler';

@Module({
  imports: [CryptographyModule],
  providers: [
    { provide: TOKEN_REPOSITORY, useClass: ActionTokenKyselyRepository },
    {
      provide: POLICY_REGISTRY,
      useFactory: () => new InMemoryActionTokenPolicyRegistry(DEFAULT_ACTION_TOKEN_POLICIES),
    },
    { provide: TOKEN_CONFIG, useFactory: () => DEFAULT_ACTION_TOKEN_CONFIG },
    // Application services
    { provide: ISSUE_TOKEN, useClass: IssueActionTokenService },
    { provide: REVOKE_TOKEN, useClass: RevokeActionTokenService },
    { provide: CONSUME_TOKEN, useClass: ConsumeActionTokenService },
    { provide: CLEANUP_EXPIRED_TOKENS, useClass: CleanupExpiredActionTokensService },
    // Schedulers
    ActionTokenCleanupScheduler,
  ],
  exports: [CONSUME_TOKEN, ISSUE_TOKEN, REVOKE_TOKEN],
})
export class ActionTokenModule {}
