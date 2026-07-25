import type { ActionTokenPolicyRegistry } from '@app/core/security/action-token/domain/policies/action-token-policy.registry';

export const makeActionTokenPolicyRegistryMock = () => {
  return {
    resolve: jest.fn(),
  } as unknown as jest.Mocked<ActionTokenPolicyRegistry>;
};
