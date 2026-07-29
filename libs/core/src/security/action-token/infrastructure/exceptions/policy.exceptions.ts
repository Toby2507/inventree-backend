import { InfrastructureException } from '@app/shared-kernel';

export class DuplicateTokenPolicyException extends InfrastructureException {
  readonly code = 'DUPLICATE_ACTION_TOKEN_POLICY';
  constructor(purpose: string) {
    super(`Duplicate action token policy for purpose "${purpose}"`, { purpose });
  }
}
