import { DomainException, EXCEPTION_CATEGORIES, type ExceptionCategory } from '@app/shared-kernel';
import { ActionTokenPurpose } from '../aggregates/action-token.types';

export class TokenPurposePolicyNotFoundException extends DomainException {
  readonly code = 'TOKEN_POLICY_NOT_FOUND';
  constructor(purpose: ActionTokenPurpose) {
    super(`No policy registered for action token purpose: ${purpose}`, { purpose });
  }

  override get category(): ExceptionCategory {
    return EXCEPTION_CATEGORIES.INTERNAL;
  }
}
