import type { OperationalDB } from '@app/database';
import type {
  ActionTokenPurpose,
  ActionTokenRevokeReason,
} from '../../domain/aggregates/action-token.types';
import type { ActionTokenID } from '../../domain/value-objects/action-token-id.vo';

export interface RevokeAllTokensForUserCommand {
  readonly userId: string;
  readonly reason: ActionTokenRevokeReason;
}

export interface RevokeTokenByIdCommand {
  readonly tokenId: ActionTokenID;
  readonly reason: ActionTokenRevokeReason;
}

export interface RevokeTokenByPurposeCommand {
  readonly userId: string;
  readonly purpose: ActionTokenPurpose;
  readonly reason: ActionTokenRevokeReason;
}

export interface RevokeActionToken {
  allForUser(db: OperationalDB, command: RevokeAllTokensForUserCommand): Promise<void>;
  byId(db: OperationalDB, command: RevokeTokenByIdCommand): Promise<void>;
  byPurpose(db: OperationalDB, command: RevokeTokenByPurposeCommand): Promise<void>;
}

export const REVOKE_TOKEN = Symbol('REVOKE_ACTION_TOKEN');
