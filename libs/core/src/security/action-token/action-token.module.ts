import { Module } from '@nestjs/common';
import { CryptographyModule } from '../cryptography';
import { CONSUME_TOKEN } from './application/ports/consume-action-token.port';
import { ISSUE_TOKEN } from './application/ports/issue-action-token.port';
import { REVOKE_TOKEN } from './application/ports/revoke-action-token.port';
import { ConsumeActionTokenService } from './application/services/consume-action-token.service';
import { IssueActionTokenService } from './application/services/issue-action-token.service';
import { RevokeActionTokenService } from './application/services/revoke-action.token.service';
import { TOKEN_REPOSITORY } from './domain/action-token.repository';
import { POLICY_REGISTRY } from './domain/policies/action-token-policy.registry';
import { DEFAULT_ACTION_TOKEN_POLICIES } from './domain/policies/default-action-token-policies';
import { ActionTokenKyselyRepository } from './infrastructure/persistence/action-token.kysely.repository';
import { InMemoryActionTokenPolicyRegistry } from './infrastructure/policies/action-token-policy.in-memory.registry';

@Module({
  imports: [CryptographyModule],
  providers: [
    { provide: TOKEN_REPOSITORY, useClass: ActionTokenKyselyRepository },
    {
      provide: POLICY_REGISTRY,
      useFactory: () => new InMemoryActionTokenPolicyRegistry(DEFAULT_ACTION_TOKEN_POLICIES),
    },
    // Application services
    { provide: ISSUE_TOKEN, useClass: IssueActionTokenService },
    { provide: REVOKE_TOKEN, useClass: RevokeActionTokenService },
    { provide: CONSUME_TOKEN, useClass: ConsumeActionTokenService },
  ],
  exports: [CONSUME_TOKEN, ISSUE_TOKEN, REVOKE_TOKEN],
})
export class ActionTokenModule {}
