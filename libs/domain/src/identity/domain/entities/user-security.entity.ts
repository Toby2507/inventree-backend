import { BaseEntity, DomainEvent } from '@app/common';
import { UserLockedOutEvent } from '../events';
import {
  MfaAlreadyEnabledException,
  MfaNotEnabledException,
  MfaSecretRequiredException,
  MfaSetupInProgressException,
  MfaSetupNotInProgressException,
} from '../exceptions';

export type MfaType = 'email' | 'totp';
export type MfaStatus = 'pending' | 'enabled' | 'disabled';

export interface UserSecuritySnapshot {
  userId: string;
  failedLoginAttempts: number;
  lastLoginAttemptedAt: Date | null;
  lockoutUntil: Date | null;
  lockoutReason: string | null;
  lastPasswordChangeAt: Date | null;
  mfaStatus: MfaStatus;
  mfaType: MfaType | null;
  mfaSecretCiphertext: Buffer | null;
  mfaSecretKid: string | null;
  mfaEnabledAt: Date | null;
  mfaLastUsedAt: Date | null;
}

export interface CreateUserSecurityProps {
  userId: string;
}

export class UserSecurity extends BaseEntity<UserSecuritySnapshot> {
  private readonly MAX_FAILED_ATTEMPTS = 10;
  private readonly LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

  private _failedLoginAttempts: number;
  private _lastLoginAttemptedAt: Date | null;
  private _lockoutUntil: Date | null;
  private _lockoutReason: string | null;
  private _lastPasswordChangeAt: Date | null;
  private _mfaStatus: MfaStatus;
  private _mfaType: MfaType | null;
  private _mfaSecretCiphertext: Buffer | null;
  private _mfaSecretKid: string | null;
  private _mfaEnabledAt: Date | null;
  private _mfaLastUsedAt: Date | null;

  private constructor(
    private readonly _userId: string,
    props: Omit<UserSecuritySnapshot, 'userId'>,
  ) {
    super();
    this._failedLoginAttempts = props.failedLoginAttempts;
    this._lastLoginAttemptedAt = props.lastLoginAttemptedAt;
    this._lockoutUntil = props.lockoutUntil;
    this._lockoutReason = props.lockoutReason;
    this._lastPasswordChangeAt = props.lastPasswordChangeAt;
    this._mfaStatus = props.mfaStatus;
    this._mfaType = props.mfaType;
    this._mfaSecretCiphertext = props.mfaSecretCiphertext;
    this._mfaSecretKid = props.mfaSecretKid;
    this._mfaEnabledAt = props.mfaEnabledAt;
    this._mfaLastUsedAt = props.mfaLastUsedAt;
  }

  // ==== FACTORY ==============
  static create(props: CreateUserSecurityProps): UserSecurity {
    return new UserSecurity(props.userId, {
      failedLoginAttempts: 0,
      lastLoginAttemptedAt: null,
      lockoutUntil: null,
      lockoutReason: null,
      lastPasswordChangeAt: null,
      mfaStatus: 'disabled',
      mfaType: null,
      mfaSecretCiphertext: null,
      mfaSecretKid: null,
      mfaEnabledAt: null,
      mfaLastUsedAt: null,
    });
  }

  static reconstitute(snapshot: UserSecuritySnapshot): UserSecurity {
    const { userId, ...rest } = snapshot;
    return new UserSecurity(userId, rest);
  }

  // ==== COMMANDS ==============
  recordFailedLogin(now: Date = new Date()): DomainEvent[] {
    this._lastLoginAttemptedAt = now;
    const events: DomainEvent[] = [];
    // Don't increment attempts if already locked out
    if (this.isLockedOut()) return events;
    this._failedLoginAttempts += 1;
    if (this._failedLoginAttempts >= this.MAX_FAILED_ATTEMPTS) {
      this._lockoutUntil = new Date(now.getTime() + this.LOCKOUT_DURATION_MS);
      this._lockoutReason = 'Too many failed login attempts';
      events.push(
        new UserLockedOutEvent({
          userId: this._userId,
          occurredAt: now,
          lockoutUntil: this._lockoutUntil,
          reason: this._lockoutReason,
          failedAttempts: this._failedLoginAttempts,
        }),
      );
    }
    return events;
  }

  recordSuccessfulLogin(now: Date = new Date()): void {
    this._lastLoginAttemptedAt = now;
    this.unlock();
  }

  recordPasswordChange(now: Date = new Date()): void {
    this._lastPasswordChangeAt = now;
    this.unlock();
  }

  startMfaSetup(type: MfaType, secretCiphertext?: Buffer, kid?: string): void {
    if (this.isMfaEnabled()) throw new MfaAlreadyEnabledException();
    if (this._mfaStatus === 'pending') throw new MfaSetupInProgressException();
    this._mfaStatus = 'pending';
    this._mfaType = type;
    if (type === 'email') return this.completeMfaSetup();
    if (!secretCiphertext || !kid) throw new MfaSecretRequiredException();
    this._mfaSecretCiphertext = secretCiphertext;
    this._mfaSecretKid = kid;
  }

  completeMfaSetup(): void {
    if (this.isMfaEnabled()) throw new MfaAlreadyEnabledException();
    if (this._mfaStatus !== 'pending') throw new MfaSetupNotInProgressException();
    this._mfaStatus = 'enabled';
    this._mfaEnabledAt = new Date();
  }

  disableMfa(): void {
    if (!this.isMfaEnabled()) throw new MfaNotEnabledException();
    this._mfaStatus = 'disabled';
    this._mfaType = null;
    this._mfaSecretCiphertext = null;
    this._mfaSecretKid = null;
    this._mfaEnabledAt = null;
  }

  recordMfaUsed(now: Date = new Date()): void {
    if (!this.isMfaEnabled()) throw new MfaNotEnabledException();
    this._mfaLastUsedAt = now;
  }

  // ==== PREDICATES ==============
  isMfaEnabled(): boolean {
    return this._mfaStatus === 'enabled';
  }

  isLockedOut(now: Date = new Date()): boolean {
    return this._lockoutUntil !== null && this._lockoutUntil > now;
  }

  // ==== GETTERS ==============
  get userId(): string {
    return this._userId;
  }
  get failedLoginAttempts(): number {
    return this._failedLoginAttempts;
  }
  get mfaStatus(): MfaStatus {
    return this._mfaStatus;
  }
  get mfaType(): MfaType | null {
    return this._mfaType;
  }
  get lockoutUntil(): Date | null {
    return this._lockoutUntil;
  }

  // ==== HELPERS ==============
  private unlock(): void {
    this._failedLoginAttempts = 0;
    this._lockoutUntil = null;
    this._lockoutReason = null;
  }

  // ==== SERIALIZATION ==============
  toSnapshot(): UserSecuritySnapshot {
    return {
      userId: this._userId,
      failedLoginAttempts: this._failedLoginAttempts,
      lastLoginAttemptedAt: this._lastLoginAttemptedAt,
      lockoutUntil: this._lockoutUntil,
      lockoutReason: this._lockoutReason,
      lastPasswordChangeAt: this._lastPasswordChangeAt,
      mfaStatus: this._mfaStatus,
      mfaType: this._mfaType,
      mfaSecretCiphertext: this._mfaSecretCiphertext,
      mfaSecretKid: this._mfaSecretKid,
      mfaEnabledAt: this._mfaEnabledAt,
      mfaLastUsedAt: this._mfaLastUsedAt,
    };
  }
}
