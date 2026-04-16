import { AggregateRoot, Email, PhoneNumber } from '@app/common';
import {
  UserDisabledEvent,
  UserEmailVerifiedEvent,
  UserEnabledEvent,
  UserRegisteredEvent,
  UserSuspendedEvent,
} from '../events';
import {
  EmailAlreadyVerifiedException,
  PhoneAlreadyVerifiedException,
  PhoneNotProvidedException,
  UserAccountLockedException,
  UserDisabledException,
  UserPendingException,
} from '../exceptions';
import { MfaType, UserSecurity, UserSecuritySnapshot } from './user-security.entity';

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
  phone?: string;
}

export interface UpdateUserProfileProps {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  phone?: string;
}

export class User extends AggregateRoot<UserSnapshot> {
  private readonly _email: Email;
  private _emailVerifiedAt: Date | null;
  private _phone: PhoneNumber | null;
  private _phoneVerifiedAt: Date | null;
  private _firstName: string | null;
  private _lastName: string | null;
  private _displayName: string | null;
  private _status: UserStatus;
  private _passwordHash: string;
  private readonly _createdAt: Date;
  private _deletedAt: Date | null;
  private readonly _security: UserSecurity;

  private constructor(
    private readonly _id: string,
    props: Omit<UserSnapshot, 'id' | 'email' | 'phone' | 'security'> & {
      email: Email;
      phone: PhoneNumber | null;
      security: UserSecurity;
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
    const user = new User(props.id, {
      email: Email.create(props.email),
      emailVerifiedAt: null,
      phone: null,
      phoneVerifiedAt: null,
      firstName: props.firstName ?? null,
      lastName: props.lastName ?? null,
      displayName: props.displayName ?? null,
      status: 'pending',
      passwordHash: props.passwordHash,
      createdAt: now,
      deletedAt: null,
      security: UserSecurity.create({ userId: props.id }),
    });

    user.addDomainEvent(
      new UserRegisteredEvent({
        userId: props.id,
        email: user._email.value,
        firstName: user._firstName,
        lastName: user._lastName,
        registeredAt: now,
      }),
    );

    return user;
  }

  static reconstitute(snapshot: UserSnapshot): User {
    const { id, email, phone, security, ...rest } = snapshot;
    return new User(id, {
      ...rest,
      email: Email.reconstitute(email),
      phone: phone ? PhoneNumber.reconstitute(phone) : null,
      security: UserSecurity.reconstitute(security),
    });
  }

  // ==== COMMANDS ==============
  verifyEmail(now: Date = new Date()): void {
    if (this._emailVerifiedAt !== null) throw new EmailAlreadyVerifiedException();
    this._emailVerifiedAt = now;
    this.addDomainEvent(
      new UserEmailVerifiedEvent({
        userId: this._id,
        email: this._email.value,
        verifiedAt: now,
      }),
    );
  }

  verifyPhone(now: Date = new Date()): void {
    if (!this._phone) throw new PhoneNotProvidedException();
    if (this._phoneVerifiedAt !== null) throw new PhoneAlreadyVerifiedException();
    this._phoneVerifiedAt = now;
  }

  changePassword(newHash: string, now: Date = new Date()): void {
    this._passwordHash = newHash;
    this._security.recordPasswordChange(now);
  }

  updateProfile(fields: UpdateUserProfileProps): void {
    if (fields.firstName !== undefined) this._firstName = fields.firstName;
    if (fields.lastName !== undefined) this._lastName = fields.lastName;
    if (fields.displayName !== undefined) this._displayName = fields.displayName;
    if (fields.phone !== undefined) {
      this._phone = PhoneNumber.create(fields.phone);
      this._phoneVerifiedAt = null; // phone change resets verification
    }
  }

  disable(now: Date = new Date(), reason?: string): void {
    this._status = 'disabled';
    this.addDomainEvent(
      new UserDisabledEvent({
        userId: this._id,
        occuredAt: now,
        reason,
      }),
    );
  }

  enable(now: Date = new Date(), reason?: string): void {
    this._status = 'active';
    this.addDomainEvent(
      new UserEnabledEvent({
        userId: this._id,
        occuredAt: now,
        reason,
      }),
    );
  }

  suspend(now: Date = new Date(), reason?: string): void {
    this._status = 'suspended';
    this.addDomainEvent(
      new UserSuspendedEvent({
        userId: this._id,
        occuredAt: now,
        reason,
      }),
    );
  }

  recordFailedLogin(now: Date = new Date()): void {
    const events = this._security.recordFailedLogin(now);
    events.forEach((event) => this.addDomainEvent(event));
  }

  recordSuccessfulLogin(now: Date = new Date()): void {
    this._security.recordSuccessfulLogin(now);
  }

  startMfaSetup(type: MfaType, secretCiphertext: Buffer, kid: string): void {
    this._security.startMfaSetup(type, secretCiphertext, kid);
  }

  completeMfaSetup(): void {
    this._security.completeMfaSetup();
  }

  disableMfa(): void {
    this._security.disableMfa();
  }

  softDelete(now: Date = new Date()): void {
    this._deletedAt = now;
  }

  // ==== INVARIANTS ==============
  ensureCanAuthenticate(now: Date = new Date()): void {
    if (this._status === 'pending') throw new UserPendingException();
    if (this._status === 'disabled') throw new UserDisabledException();
    if (this._security.isLockedOut(now)) {
      throw new UserAccountLockedException(this._security.lockoutUntil!);
    }
  }

  // ==== PREDICATES ==============
  isActive(): boolean {
    return this._status === 'active' && this._deletedAt === null;
  }

  // ==== GETTERS ==============
  get id(): string {
    return this._id;
  }
  get email(): string {
    return this._email.value;
  }
  get status(): UserStatus {
    return this._status;
  }
  get passwordHash(): string {
    return this._passwordHash;
  }
  get firstName(): string | null {
    return this._firstName;
  }
  get lastName(): string | null {
    return this._lastName;
  }
  get displayName(): string | null {
    return this._displayName;
  }
  get isEmailVerified(): boolean {
    return this._emailVerifiedAt !== null;
  }

  // ==== SERIALIZATION ==============
  toSnapshot(): UserSnapshot {
    return {
      id: this._id,
      email: this._email.value,
      emailVerifiedAt: this._emailVerifiedAt,
      phone: this._phone?.value ?? null,
      phoneVerifiedAt: this._phoneVerifiedAt,
      firstName: this._firstName,
      lastName: this._lastName,
      displayName: this._displayName,
      status: this._status,
      passwordHash: this._passwordHash,
      createdAt: this._createdAt,
      deletedAt: this._deletedAt,
      security: this._security.toSnapshot(),
    };
  }
}
