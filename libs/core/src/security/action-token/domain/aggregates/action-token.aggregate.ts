import { AggregateRoot, Instant } from '@app/shared-kernel';
import {
  TokenAlreadyConsumedException,
  TokenExpiredException,
  TokenExpiryBeforeCreationTimeException,
  TokenRevokedException,
} from '../exceptions/action-token.exceptions';
import { ActionTokenID } from '../value-objects/action-token-id.vo';
import type { ActionTokenPurpose, ActionTokenRevokeReason } from './action-token.types';

export interface ActionTokenSnapshot {
  id: string;
  userId: string;
  purpose: ActionTokenPurpose;
  tokenHash: string;
  createdAt: Instant;
  expiresAt: Instant;
  consumedAt: Instant | null;
  revokedAt: Instant | null;
  revokedReason: ActionTokenRevokeReason | null;
  version: number;
}

export interface CreateActionTokenProps {
  id: string;
  userId: string;
  purpose: ActionTokenPurpose;
  tokenHash: string;
  expiresAt: Instant;
  createdAt: Instant;
}

export class ActionToken extends AggregateRoot<ActionTokenSnapshot> {
  private readonly _id: ActionTokenID;
  private readonly _userId: string;
  private readonly _purpose: ActionTokenPurpose;
  private readonly _tokenHash: string;
  private readonly _createdAt: Instant;
  private readonly _expiresAt: Instant;
  private _consumedAt: Instant | null;
  private _revokedAt: Instant | null;
  private _revokedReason: ActionTokenRevokeReason | null;
  private _version: number;

  private constructor(props: Omit<ActionTokenSnapshot, 'id'> & { id: ActionTokenID }) {
    super();
    this._id = props.id;
    this._userId = props.userId;
    this._purpose = props.purpose;
    this._tokenHash = props.tokenHash;
    this._createdAt = props.createdAt;
    this._expiresAt = props.expiresAt;
    this._consumedAt = props.consumedAt;
    this._revokedAt = props.revokedAt;
    this._revokedReason = props.revokedReason;
    this._version = props.version;
    this.ensureCreationDateIsBeforeExpiry();
  }

  // ==== FACTORY ==============
  static create(props: CreateActionTokenProps): ActionToken {
    return new ActionToken({
      id: ActionTokenID.from(props.id),
      userId: props.userId,
      purpose: props.purpose,
      tokenHash: props.tokenHash,
      createdAt: props.createdAt,
      expiresAt: props.expiresAt,
      consumedAt: null,
      revokedAt: null,
      revokedReason: null,
      version: 0,
    });
  }

  static reconstitute(snapshot: ActionTokenSnapshot): ActionToken {
    const { id, ...rest } = snapshot;
    return new ActionToken({
      id: ActionTokenID.from(id),
      ...rest,
    });
  }

  // ==== COMMANDS ==============
  consume(now: Instant): void {
    if (this.isConsumed()) throw new TokenAlreadyConsumedException();
    if (this.isRevoked()) throw new TokenRevokedException();
    if (this.isExpired(now)) throw new TokenExpiredException();
    this._consumedAt = now;
    this._version++;
  }

  revoke(reason: ActionTokenRevokeReason, now: Instant): void {
    if (this.isRevoked()) return;
    if (this.isConsumed()) throw new TokenAlreadyConsumedException();
    this._revokedAt = now;
    this._revokedReason = reason;
    this._version++;
  }

  // ==== INVARIANTS ==============
  private ensureCreationDateIsBeforeExpiry(): void {
    if (this._expiresAt.isBefore(this._createdAt))
      throw new TokenExpiryBeforeCreationTimeException();
  }

  // ==== PREDICATES ==============
  isConsumed(): boolean {
    return this._consumedAt !== null;
  }

  isRevoked(): boolean {
    return this._revokedAt !== null;
  }

  isExpired(now: Instant): boolean {
    return now.isAfterOrEqual(this._expiresAt);
  }

  isUsable(now: Instant): boolean {
    return !this.isConsumed() && !this.isRevoked() && !this.isExpired(now);
  }

  // ==== GETTERS ==============
  get id(): ActionTokenID {
    return this._id;
  }
  get userId(): string {
    return this._userId;
  }
  get purpose(): ActionTokenPurpose {
    return this._purpose;
  }
  get tokenHash(): string {
    return this._tokenHash;
  }
  get expiresAt(): Instant {
    return this._expiresAt;
  }
  get version(): number {
    return this._version;
  }

  // ==== SERIALIZATION ==============
  toSnapshot(): ActionTokenSnapshot {
    return {
      id: this._id.value,
      userId: this._userId,
      purpose: this._purpose,
      tokenHash: this._tokenHash,
      createdAt: this._createdAt,
      expiresAt: this._expiresAt,
      consumedAt: this._consumedAt,
      revokedAt: this._revokedAt,
      revokedReason: this._revokedReason,
      version: this._version,
    };
  }
}
