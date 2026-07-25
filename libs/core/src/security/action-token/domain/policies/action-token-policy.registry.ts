import { ActionTokenPurpose } from '../aggregates/action-token.types';
import { ActionTokenPolicy } from './action-token-policy';

export interface ActionTokenPolicyRegistry {
  resolve(purpose: ActionTokenPurpose): ActionTokenPolicy;
}

export const TOKEN_POLICY_REGISTRY = Symbol('TOKEN_POLICY_REGISTRY');
