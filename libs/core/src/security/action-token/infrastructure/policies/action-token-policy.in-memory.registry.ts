import { ActionTokenPurpose } from '../../domain/aggregates/action-token.types';
import { TokenPurposePolicyNotFoundException } from '../../domain/exceptions/policy.exception';
import { ActionTokenPolicy } from '../../domain/policies/action-token-policy';
import { ActionTokenPolicyRegistry } from '../../domain/policies/action-token-policy.registry';
import { DuplicateTokenPolicyException } from '../exceptions/policy.exceptions';

export class InMemoryActionTokenPolicyRegistry implements ActionTokenPolicyRegistry {
  private readonly policies: ReadonlyMap<ActionTokenPurpose, ActionTokenPolicy>;

  constructor(policies: ActionTokenPolicy[]) {
    const map = new Map<ActionTokenPurpose, ActionTokenPolicy>();
    for (const policy of policies) {
      if (map.has(policy.purpose)) throw new DuplicateTokenPolicyException(policy.purpose);
      map.set(policy.purpose, policy);
    }
    this.policies = map;
  }

  resolve(purpose: ActionTokenPurpose): ActionTokenPolicy {
    const policy = this.policies.get(purpose);
    if (!policy) throw new TokenPurposePolicyNotFoundException(purpose);
    return policy;
  }
}
