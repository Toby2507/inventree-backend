import { AggregateRoot, Email, PhoneNumber } from '@app/common';
import {
  AuthenticationBlockedEvent,
  UserDisabledEvent,
  UserEmailVerifiedEvent,
  UserEnabledEvent,
  UserRegisteredEvent,
  UserSuspendedEvent,
} from '../events';
import {
  InvalidUserStatusTransitionException,
  PhoneNotProvidedException,
  UserCannotAuthenticateException,
  UserNotActiveException,
} from '../exceptions';
import { PasswordHash, PersonName, UserID } from '../value-objects';
import { MfaType, UserSecurity, UserSecuritySnapshot } from './user-security.entity';

type AuthenticationCheck =
  | { allowed: true }
  | { allowed: false; reason: AuthenticationBlockedReason };
type SnapShotVOFields =
  | 'id'
  | 'email'
  | 'phone'
  | 'security'
  | 'passwordHash'
  | 'firstName'
  | 'lastName'
  | 'displayName';
export type AuthenticationBlockedReason =
  | 'account_disabled'
  | 'account_pending'
  | 'account_deleted'
  | 'locked_out';
export type UserStatus = 'active' | 'suspended' | 'pending' | 'disabled';

export interface UserSnapshot {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  phone: string | null;
  phoneVerifiedAt: Date | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  status: UserStatus;
  passwordHash: string;
  createdAt: Date;
  deletedAt: Date | null;
  security: UserSecuritySnapshot;
}
export interface CreateUserProps {
  id: string;
  email: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
}
export interface UpdateUserProfileProps {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  phone?: string;
}

const ALLOWED_TRANSITIONS: Record<UserStatus, UserStatus[]> = {
  active: ['suspended', 'disabled'],
  suspended: ['active', 'disabled'],
  disabled: [],
  pending: [],
};

export class User extends AggregateRoot<UserSnapshot> {
  private readonly _email: Email;
  private _emailVerifiedAt: Date | null;
  private _phone: PhoneNumber | null;
  private _phoneVerifiedAt: Date | null;
  private _firstName: PersonName | null;
  private _lastName: PersonName | null;
  private _displayName: PersonName | null;
  private _status: UserStatus;
  private _passwordHash: PasswordHash;
  private readonly _createdAt: Date;
  private _deletedAt: Date | null;
  private readonly _security: UserSecurity;

  private constructor(
    private readonly _id: UserID,
    props: Omit<UserSnapshot, SnapShotVOFields> & {
      email: Email;
      phone: PhoneNumber | null;
      security: UserSecurity;
      passwordHash: PasswordHash;
      firstName: PersonName | null;
      lastName: PersonName | null;
      displayName: PersonName | null;
    },
  ) {
    super();
    this._email = props.email;
    this._emailVerifiedAt = props.emailVerifiedAt;
    this._phone = props.phone;
    this._phoneVerifiedAt = props.phoneVerifiedAt;
    this._firstName = props.firstName;
    this._lastName = props.lastName;
    this._displayName = props.displayName;
    this._status = props.status;
    this._passwordHash = props.passwordHash;
    this._createdAt = props.createdAt;
    this._deletedAt = props.deletedAt;
    this._security = props.security;
  }

  // ==== FACTORY ==============
  static create(props: CreateUserProps): User {
    const now = new Date();
    const user = new User(UserID.from(props.id), {
      email: Email.create(props.email),
      emailVerifiedAt: null,
      phone: null,
      phoneVerifiedAt: null,
      firstName: props.firstName ? PersonName.create(props.firstName) : null,
      lastName: props.lastName ? PersonName.create(props.lastName) : null,
      displayName: props.displayName ? PersonName.create(props.displayName) : null,
      status: 'pending',
      passwordHash: PasswordHash.create(props.passwordHash),
      createdAt: now,
      deletedAt: null,
      security: UserSecurity.create({ userId: props.id }),
    });

    user.addDomainEvent(
      new UserRegisteredEvent({
        userId: props.id,
        email: user._email.value,
        firstName: user._firstName?.value ?? null,
        lastName: user._lastName?.value ?? null,
        registeredAt: now,
      }),
    );

    return user;
  }

  static reconstitute(snapshot: UserSnapshot): User {
    const { id, email, phone, security, passwordHash, firstName, lastName, displayName, ...rest } =
      snapshot;
    return new User(UserID.from(id), {
      ...rest,
      email: Email.reconstitute(email),
      phone: phone ? PhoneNumber.reconstitute(phone) : null,
      security: UserSecurity.reconstitute(security),
      passwordHash: PasswordHash.reconstitute(passwordHash),
      firstName: firstName ? PersonName.reconstitute(firstName) : null,
      lastName: lastName ? PersonName.reconstitute(lastName) : null,
      displayName: displayName ? PersonName.reconstitute(displayName) : null,
    });
  }

  // ==== COMMANDS ==============
  verifyEmail(now: Date = new Date()): void {
    if (this._emailVerifiedAt !== null) return; // idempotent - already verified
    if (this._status !== 'pending' && !this.canPerformActions()) throw new UserNotActiveException();
    this._emailVerifiedAt = now;
    this.addDomainEvent(
      new UserEmailVerifiedEvent({
        userId: this._id.value,
        email: this._email.value,
        verifiedAt: now,
      }),
    );
    if (this._status === 'pending') {
      this._status = 'active';
      this.addDomainEvent(
        new UserEnabledEvent({
          userId: this._id.value,
          reason: 'User email successfully verified.',
        }),
      );
    }
  }

  verifyPhone(now: Date = new Date()): void {
    this.ensureCanPerformActions();
    if (!this._phone) throw new PhoneNotProvidedException();
    if (this._phoneVerifiedAt !== null) return; // idempotent - already verified
    this._phoneVerifiedAt = now;
  }

  changePassword(newHash: string, now: Date = new Date()): void {
    this.ensureCanPerformActions();
    this._passwordHash = PasswordHash.create(newHash);
    this._security.recordPasswordChange(now);
  }

  updateProfile(fields: UpdateUserProfileProps): void {
    this.ensureCanPerformActions();
    if (fields.firstName !== undefined) {
      this._firstName = fields.firstName ? PersonName.create(fields.firstName) : null;
    }
    if (fields.lastName !== undefined) {
      this._lastName = fields.lastName ? PersonName.create(fields.lastName) : null;
    }
    if (fields.displayName !== undefined) {
      this._displayName = fields.displayName ? PersonName.create(fields.displayName) : null;
    }
    if (fields.phone !== undefined) {
      this._phone = PhoneNumber.create(fields.phone);
      this._phoneVerifiedAt = null; // phone change resets verification
    }
  }

  disable(reason?: string): void {
    if (this._status === 'disabled') return; // idempotent
    this.ensureStatusTransitionIsValid('disabled');
    this._status = 'disabled';
    this.addDomainEvent(
      new UserDisabledEvent({
        userId: this._id.value,
        reason,
      }),
    );
  }

  enable(reason?: string): void {
    if (this._status === 'active') return; // idempotent
    this.ensureStatusTransitionIsValid('active');
    this._status = 'active';
    this.addDomainEvent(
      new UserEnabledEvent({
        userId: this._id.value,
        reason,
      }),
    );
  }

  suspend(reason?: string): void {
    if (this._status === 'suspended') return; // idempotent
    this.ensureStatusTransitionIsValid('suspended');
    this._status = 'suspended';
    this.addDomainEvent(
      new UserSuspendedEvent({
        userId: this._id.value,
        reason,
      }),
    );
  }

  recordFailedLogin(now: Date = new Date()): void {
    const canAuth = this.canAuthenticate(now);
    if (canAuth.allowed) {
      const events = this._security.recordFailedLogin(now);
      events.forEach((event) => this.addDomainEvent(event));
    } else {
      this.addDomainEvent(
        new AuthenticationBlockedEvent({ userId: this._id.value, reason: canAuth.reason }),
      );
    }
  }

  recordSuccessfulLogin(now: Date = new Date()): void {
    const canAuth = this.canAuthenticate(now);
    if (canAuth.allowed) {
      const events = this._security.recordSuccessfulLogin(now);
      events.forEach((event) => this.addDomainEvent(event));
    } else {
      this.addDomainEvent(
        new AuthenticationBlockedEvent({ userId: this._id.value, reason: canAuth.reason }),
      );
    }
  }

  startMfaSetup(type: MfaType, secretCiphertext?: Buffer, kid?: string): void {
    this.ensureCanPerformActions();
    this._security.startMfaSetup(type, secretCiphertext, kid);
  }

  completeMfaSetup(): void {
    this.ensureCanPerformActions();
    this._security.completeMfaSetup();
  }

  disableMfa(): void {
    this.ensureCanPerformActions();
    this._security.disableMfa();
  }

  recordMfaUse(now: Date = new Date()): void {
    this.ensureCanPerformActions();
    this._security.recordMfaUsed(now);
  }

  softDelete(now: Date = new Date()): void {
    this.ensureCanPerformActions();
    if (this._deletedAt !== null) return; // idempotent
    this._deletedAt = now;
  }

  // ==== INVARIANTS ==============
  ensureCanAuthenticate(now: Date = new Date()): void {
    if (!this.canAuthenticate(now).allowed) throw new UserCannotAuthenticateException();
  }

  ensureCanPerformActions(): void {
    if (!this.canPerformActions()) throw new UserNotActiveException();
  }

  ensureStatusTransitionIsValid(target: UserStatus): void {
    const allowed = ALLOWED_TRANSITIONS[this._status];
    if (!allowed || !allowed.includes(target)) {
      throw new InvalidUserStatusTransitionException(this._status, target);
    }
  }

  // ==== PREDICATES ==============
  canAuthenticate(now: Date = new Date()): AuthenticationCheck {
    if (this._deletedAt !== null) return { allowed: false, reason: 'account_deleted' };
    if (this._status === 'pending') return { allowed: false, reason: 'account_pending' };
    if (this._status === 'disabled') return { allowed: false, reason: 'account_disabled' };
    if (this._security.isLockedOut(now)) return { allowed: false, reason: 'locked_out' };
    return { allowed: true };
  }

  canPerformActions(): boolean {
    return this._status === 'active' && this._deletedAt === null;
  }

  // ==== GETTERS ==============
  get id(): UserID {
    return this._id;
  }
  get email(): Email {
    return this._email;
  }
  get phone(): PhoneNumber | null {
    return this._phone;
  }
  get status(): UserStatus {
    return this._status;
  }
  get passwordHash(): PasswordHash {
    return this._passwordHash;
  }
  get firstName(): PersonName | null {
    return this._firstName;
  }
  get lastName(): PersonName | null {
    return this._lastName;
  }
  get displayName(): PersonName | null {
    return this._displayName;
  }
  get isEmailVerified(): boolean {
    return this._emailVerifiedAt !== null;
  }
  get isPhoneVerified(): boolean {
    return this._phoneVerifiedAt !== null;
  }

  // ==== SERIALIZATION ==============
  toSnapshot(): UserSnapshot {
    return {
      id: this._id.value,
      email: this._email.value,
      emailVerifiedAt: this._emailVerifiedAt,
      phone: this._phone?.value ?? null,
      phoneVerifiedAt: this._phoneVerifiedAt,
      firstName: this._firstName?.value ?? null,
      lastName: this._lastName?.value ?? null,
      displayName: this._displayName?.value ?? null,
      status: this._status,
      passwordHash: this._passwordHash.value,
      createdAt: this._createdAt,
      deletedAt: this._deletedAt,
      security: this._security.toSnapshot(),
    };
  }
}
