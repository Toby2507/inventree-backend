import { Duration } from '@app/shared-kernel';
import { ACTION_TOKEN_PURPOSE } from '../../domain/aggregates/action-token.types';
import { TokenPurposePolicyNotFoundException } from '../../domain/exceptions/policy.exception';
import { ActionTokenPolicy } from '../../domain/policies/action-token-policy';
import { DuplicateTokenPolicyException } from '../exceptions/policy.exceptions';
import { InMemoryActionTokenPolicyRegistry } from './action-token-policy.in-memory.registry';

describe('InMemoryActionTokenPolicyRegistry', () => {
  const emailVerification: ActionTokenPolicy = {
    purpose: ACTION_TOKEN_PURPOSE.EMAIL_VERIFICATION,
    ttl: Duration.hours(24),
    singleActiveInstance: true,
  };

  it('should resolve a registered policy by purpose', () => {
    const registry = new InMemoryActionTokenPolicyRegistry([emailVerification]);
    expect(registry.resolve(ACTION_TOKEN_PURPOSE.EMAIL_VERIFICATION)).toBe(emailVerification);
  });

  it('should throw TokenPurposePolicyNotFoundException for an unregistered purpose', () => {
    const registry = new InMemoryActionTokenPolicyRegistry([emailVerification]);
    expect(() => registry.resolve(ACTION_TOKEN_PURPOSE.PASSWORD_RESET)).toThrow(
      TokenPurposePolicyNotFoundException,
    );
  });

  it('should reject duplicate policies for the same purpose at construction time', () => {
    expect(
      () => new InMemoryActionTokenPolicyRegistry([emailVerification, emailVerification]),
    ).toThrow(DuplicateTokenPolicyException);
  });
});
