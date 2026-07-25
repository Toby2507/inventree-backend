import { Module } from '@nestjs/common';
import { CryptographyModule } from '../cryptography';
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
  ],
})
export class ActionTokenModule {}
