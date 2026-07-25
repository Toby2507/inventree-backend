import { InfrastructureException } from '@app/shared-kernel';

export class DuplicateTokenHashException extends InfrastructureException {
  readonly code = 'DUPLICATE_TOKEN_HASH';
  constructor(cause?: unknown) {
    super('Generated an action token with an existing hash', { cause });
  }
}
