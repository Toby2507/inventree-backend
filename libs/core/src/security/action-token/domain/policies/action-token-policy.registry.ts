import type { ActionTokenPurpose } from '../aggregates/action-token.types';
import type { ActionTokenPolicy } from './action-token-policy';

export interface ActionTokenPolicyRegistry {
  resolve(purpose: ActionTokenPurpose): ActionTokenPolicy;
}

export const POLICY_REGISTRY = Symbol('TOKEN_POLICY_REGISTRY');
