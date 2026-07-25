import { Module } from '@nestjs/common';
import { TOKEN_POLICY_REGISTRY } from './domain/policies/action-token-policy.registry';
import { InMemoryActionTokenPolicyRegistry } from './infrastructure/policies/action-token-policy.in-memory.registry';
import { DEFAULT_ACTION_TOKEN_POLICIES } from './domain/policies/default-action-token-policies';
import { TOKEN_REPOSITORY } from './domain/action-token.repository';
import { ActionTokenKyselyRepository } from './infrastructure/persistence/action-token.kysely.repository';
import { CryptographyModule } from '../cryptography';

@Module({
  imports: [CryptographyModule],
  providers: [
    { provide: TOKEN_REPOSITORY, useClass: ActionTokenKyselyRepository },
    {
      provide: TOKEN_POLICY_REGISTRY,
      useFactory: () => new InMemoryActionTokenPolicyRegistry(DEFAULT_ACTION_TOKEN_POLICIES),
    },
  ],
})
export class ActionTokenModule {}
