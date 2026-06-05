import { Email } from '@app/common/value-objects';
import { feUser, fsUser } from '@app/testing/identity';
import { faker } from '@app/testing/utils';
import { AuthenticationBlockedEvent } from '../events/authentication-blocked.event';
import { UserDisabledEvent } from '../events/user-disabled.event';
import { UserEmailVerifiedEvent } from '../events/user-email-verified.event';
import { UserEnabledEvent } from '../events/user-enabled.event';
import { UserLockedOutEvent } from '../events/user-locked-out.event';
import { UserLoggedInEvent } from '../events/user-logged-in.event';
import { UserRegisteredEvent } from '../events/user-registered.event';
import { UserSuspendedEvent } from '../events/user-suspended.event';
import {
  MfaNotEnabledException,
  MfaSecretRequiredException,
  MfaSetupNotInProgressException,
  PhoneNotProvidedException,
} from '../exceptions/security.exceptions';
import {
  InvalidUserStatusTransitionException,
  UserCannotAuthenticateException,
  UserNotActiveException,
} from '../exceptions/user.exceptions';
import { PasswordHash } from '../value-objects/password-hash.vo';
import { PersonName } from '../value-objects/person-name.vo';
import { UserID } from '../value-objects/user-id.vo';
import { User, UserSnapshot } from './user.aggregate';

const generateActiveUser = (overrides: Partial<UserSnapshot> = {}): User => {
  return feUser.generateFromSnapshot({ ...overrides, status: 'active' });
};
const recordFailures = (user: User, count: number, now?: Date) => {
  for (let i = 0; i < count; i++) user.recordFailedLogin(now);
};

describe('User Aggregate Root', () => {
  // ==== FACTORY ==============
  describe('User.create()', () => {
    const user = feUser.generate();

    it('should create a user with the correct properties', () => {
      expect(user.id).toBeInstanceOf(UserID);
      expect(user.email).toBeInstanceOf(Email);
      expect(user.phone).toBeNull();
      expect(user.firstName).toBeNull();
      expect(user.lastName).toBeNull();
      expect(user.displayName).toBeNull();
      expect(user.passwordHash).toBeInstanceOf(PasswordHash);
      expect(user.status).toBe('pending');
      expect(user.isEmailVerified).toBe(false);
      expect(user.isPhoneVerified).toBe(false);
    });

    it('should create a user with optional properties', () => {
      const user = feUser.generate({
        firstName: 'John',
        lastName: 'Doe',
        displayName: 'John Doe',
      });
      expect(user.firstName).toBeInstanceOf(PersonName);
      expect(user.lastName).toBeInstanceOf(PersonName);
      expect(user.displayName).toBeInstanceOf(PersonName);
    });

    it('should emit UserRegisteredEvent', () => {
      const events = user.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events).toEqual(expect.arrayContaining([expect.any(UserRegisteredEvent)]));
    });

    it('should emit correct payload in UserRegisteredEvent', () => {
      const user = feUser.generate();
      const events = user.pullDomainEvents();
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            eventType: UserRegisteredEvent.EVENT_TYPE,
            payload: expect.objectContaining({
              userId: user.id.value,
              email: user.email.value,
              firstName: null,
              lastName: null,
              registeredAt: expect.any(Date),
            }),
          }),
        ]),
      );
    });
  });

  describe('User.reconstitute()', () => {
    it('should reconstitute a user from a snapshot', () => {
      const snapshot = fsUser.generate({
        firstName: 'John',
        lastName: 'Doe',
        status: 'active',
      });
      const user = User.reconstitute(snapshot);
      expect(user.firstName?.value).toBe('John');
      expect(user.lastName?.value).toBe('Doe');
      expect(user.status).toBe('active');
    });

    it('should not emit events when reconstituting', () => {
      const snapshot = fsUser.generate();
      const user = User.reconstitute(snapshot);
      const events = user.pullDomainEvents();
      expect(events).toHaveLength(0);
    });

    it('round-trips through toSnapshot() without data loss', () => {
      const snapshot = fsUser.generate({
        firstName: 'John',
        lastName: 'Doe',
        phone: '+2349058731812',
      });
      const user = User.reconstitute(snapshot);
      const roundTripped = user.toSnapshot();
      expect(roundTripped).toEqual(snapshot);
    });
  });

  // ==== COMMANDS ==============
  describe('User.verifyEmail()', () => {
    describe('guards', () => {
      it('should throw if user is account is disabled', () => {
        const user = feUser.generateFromSnapshot({ status: 'disabled' });
        expect(() => user.verifyEmail()).toThrow(UserNotActiveException);
      });

      it('should throw if user is suspended', () => {
        const user = feUser.generateFromSnapshot({ status: 'suspended' });
        expect(() => user.verifyEmail()).toThrow(UserNotActiveException);
      });

      it('should throw if user is active but cannot perform actions', () => {
        const user = feUser.generateFromSnapshot({ status: 'active', deletedAt: new Date() });
        expect(() => user.verifyEmail()).toThrow(UserNotActiveException);
      });
    });

    describe('when user is active but pending email verification', () => {
      it('should mark isEmailVerified as true', () => {
        const user = generateActiveUser();
        user.verifyEmail();
        expect(user.isEmailVerified).toBe(true);
      });

      it('should emit a UserEmailVerifiedEvent', () => {
        const user = generateActiveUser();
        user.verifyEmail();
        const events = user.pullDomainEvents();
        expect(events).toEqual(expect.arrayContaining([expect.any(UserEmailVerifiedEvent)]));
      });

      it('should emit the correct payload in UserEmailVerifiedEvent', () => {
        const user = generateActiveUser();
        const now = new Date('2026-01-15T10:00:00Z');
        user.verifyEmail(now);
        const events = user.pullDomainEvents();
        expect(events).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              eventType: UserEmailVerifiedEvent.EVENT_TYPE,
              payload: expect.objectContaining({
                userId: user.id.value,
                email: user.email.value,
                verifiedAt: now,
              }),
            }),
          ]),
        );
      });
    });

    describe('when user is pending due to incomplete registration', () => {
      it('should transition user to active status', () => {
        const user = feUser.generateFromSnapshot();
        user.verifyEmail();
        expect(user.status).toBe('active');
      });

      it('should emit UserEnabledEvent', () => {
        const user = feUser.generateFromSnapshot();
        user.verifyEmail();
        const events = user.pullDomainEvents();
        expect(events).toEqual(expect.arrayContaining([expect.any(UserEnabledEvent)]));
      });

      it('should emit the correct payload in UserEnabledEvent', () => {
        const user = feUser.generateFromSnapshot();
        user.verifyEmail();
        const events = user.pullDomainEvents();
        expect(events).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              eventType: UserEnabledEvent.EVENT_TYPE,
              payload: expect.objectContaining({
                userId: user.id.value,
                reason: 'User email successfully verified.',
              }),
            }),
          ]),
        );
      });
    });

    describe('idempotency checks', () => {
      it('should be idempotent if already verified', () => {
        const user = feUser.generateFromSnapshot({ emailVerifiedAt: new Date() });
        expect(() => user.verifyEmail()).not.toThrow();
        expect(user.pullDomainEvents()).toHaveLength(0);
      });

      it('should emit event only once even if called multiple times', () => {
        const user = generateActiveUser();
        user.verifyEmail();
        user.verifyEmail();
        const events = user.pullDomainEvents();
        expect(events).toHaveLength(1);
      });
    });
  });

  describe('User.verifyPhone()', () => {
    it('should throw if user cannot perform actions', () => {
      const user = feUser.generateFromSnapshot({ phone: '+2349058731812' });
      expect(() => user.verifyPhone()).toThrow(UserNotActiveException);
    });

    it('should throw when phone number is not available', () => {
      const user = generateActiveUser();
      expect(() => user.verifyPhone()).toThrow(PhoneNotProvidedException);
    });

    it('should mark isPhoneVerified as true', () => {
      const user = generateActiveUser({ phone: '+2349058731812' });
      user.verifyPhone();
      expect(user.isPhoneVerified).toBe(true);
    });

    it('should be idempotent if already verified', () => {
      const user = generateActiveUser({
        phone: '+2349058731812',
        phoneVerifiedAt: new Date(),
      });
      expect(() => user.verifyPhone()).not.toThrow();
    });

    it('should be callable multiple times without throwing', () => {
      const user = generateActiveUser({ phone: '+2349058731812' });
      user.verifyPhone();
      user.verifyPhone();
      expect(user.isPhoneVerified).toBe(true);
    });
  });

  describe('User.changePassword()', () => {
    const hash = faker.string.alphanumeric(34);

    it('should throw if user cannot perform actions', () => {
      const user = feUser.generate();
      expect(() => user.changePassword(hash)).toThrow(UserNotActiveException);
    });

    it('should update the passwordHash', () => {
      const user = generateActiveUser();
      user.changePassword(hash);
      expect(user.passwordHash.value).toBe(hash);
    });

    it('should update security metadata when password changes', () => {
      const user = generateActiveUser();
      user.changePassword(hash);
      const security = user.toSnapshot().security;
      expect(security.lastPasswordChangeAt).not.toBeNull();
    });
  });

  describe('User.updateProfile()', () => {
    it('should throw if user cannot perform actions', () => {
      const user = feUser.generate();
      expect(() => user.updateProfile({ firstName: 'Jane' })).toThrow(UserNotActiveException);
    });

    it('should update provided fields', () => {
      const user = generateActiveUser();
      user.enable();
      user.updateProfile({
        firstName: 'Adekoya',
        lastName: 'Roland',
        displayName: 'Adekoya R.',
        phone: '+2349058731812',
      });
      expect(user.firstName?.value).toBe('Adekoya');
      expect(user.lastName?.value).toBe('Roland');
      expect(user.displayName?.value).toBe('Adekoya R.');
      expect(user.phone?.value).toBe('+2349058731812');
    });

    it('should leave non-updated fields unchanged', () => {
      const user = generateActiveUser({
        firstName: 'John',
        lastName: 'Doe',
        displayName: 'John Doe',
      });
      user.enable();
      user.updateProfile({ firstName: 'Jane' });
      expect(user.firstName?.value).toBe('Jane');
      expect(user.lastName?.value).toBe('Doe');
      expect(user.displayName?.value).toBe('John Doe');
    });

    it('should reset phone verification when phone is updated', () => {
      const user = generateActiveUser({
        phone: '+2348000000000',
        phoneVerifiedAt: new Date(),
      });
      expect(user.isPhoneVerified).toBe(true);
      user.updateProfile({ phone: '+2349058731812' });
      expect(user.phone?.value).toBe('+2349058731812');
      expect(user.isPhoneVerified).toBe(false);
    });
  });

  describe('User.disable()', () => {
    describe('when transition is invalid', () => {
      it('should throw if transition is invalid', () => {
        const user = feUser.generate();
        expect(() => user.disable()).toThrow(InvalidUserStatusTransitionException);
        expect(user.status).toBe('pending');
      });
    });

    describe('when transition is valid', () => {
      let user: User;
      beforeEach(() => {
        user = generateActiveUser();
      });

      it('should set user status to disabled', () => {
        user.disable();
        expect(user.status).toBe('disabled');
      });

      it('should emit a UserDisabledEvent', () => {
        user.disable();
        const events = user.pullDomainEvents();
        expect(events).toEqual(expect.arrayContaining([expect.any(UserDisabledEvent)]));
      });

      it('should emit the correct payload in UserDisabledEvent', () => {
        user.disable('terms of service violation');
        const events = user.pullDomainEvents();
        expect(events).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              eventType: UserDisabledEvent.EVENT_TYPE,
              payload: expect.objectContaining({
                userId: user.id.value,
                reason: 'terms of service violation',
              }),
            }),
          ]),
        );
      });

      it('should allow reason to be optional in UserDisabledEvent', () => {
        user.disable();
        const [event] = user.pullDomainEvents() as UserDisabledEvent[];
        expect(event.payload.reason).toBeUndefined();
      });
    });

    describe('idempotency checks', () => {
      it('should do nothing is account is already disabled', () => {
        const user = feUser.generateFromSnapshot({ status: 'disabled' });
        expect(() => user.disable()).not.toThrow();
        expect(user.pullDomainEvents()).toHaveLength(0);
      });

      it('should emit event only once even if called multiple times', () => {
        const user = generateActiveUser();
        user.disable();
        user.disable();
        const events = user.pullDomainEvents();
        expect(events).toHaveLength(1);
      });
    });
  });

  describe('User.enable()', () => {
    describe('when transition is invalid', () => {
      it('should throw if transition is invalid', () => {
        const user = feUser.generateFromSnapshot({ status: 'disabled' });
        expect(() => user.enable()).toThrow(InvalidUserStatusTransitionException);
        expect(user.status).toBe('disabled');
      });
    });

    describe('when transition is valid', () => {
      let user: User;
      beforeEach(() => {
        user = feUser.generateFromSnapshot({ status: 'suspended' });
      });

      it('should set user status to active', () => {
        user.enable();
        expect(user.status).toBe('active');
      });

      it('should emit a UserEnabledEvent', () => {
        user.enable();
        const events = user.pullDomainEvents();
        expect(events).toEqual(expect.arrayContaining([expect.any(UserEnabledEvent)]));
      });

      it('should emit the correct payload in UserEnabledEvent', () => {
        user.enable('user email verified');
        const events = user.pullDomainEvents();
        expect(events).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              eventType: UserEnabledEvent.EVENT_TYPE,
              payload: expect.objectContaining({
                userId: user.id.value,
                reason: 'user email verified',
              }),
            }),
          ]),
        );
      });

      it('should allow reason to be optional in UserEnabledEvent', () => {
        user.enable();
        const [event] = user.pullDomainEvents() as UserEnabledEvent[];
        expect(event.payload.reason).toBeUndefined();
      });
    });

    describe('idempotency checks', () => {
      it('should do nothing is account is already active', () => {
        const user = feUser.generateFromSnapshot({ status: 'active' });
        expect(() => user.enable()).not.toThrow();
        expect(user.pullDomainEvents()).toHaveLength(0);
      });

      it('should emit event only once even if called multiple times', () => {
        const user = feUser.generateFromSnapshot({ status: 'suspended' });
        user.enable();
        user.enable();
        const events = user.pullDomainEvents();
        expect(events).toHaveLength(1);
      });
    });
  });

  describe('User.suspend()', () => {
    describe('when transition is invalid', () => {
      it('should throw if transition is invalid', () => {
        const user = feUser.generateFromSnapshot({ status: 'disabled' });
        expect(() => user.suspend()).toThrow(InvalidUserStatusTransitionException);
        expect(user.status).toBe('disabled');
      });
    });

    describe('when transition is valid', () => {
      let user: User;
      beforeEach(() => {
        user = generateActiveUser();
      });

      it('should set user status to suspended', () => {
        user.suspend();
        expect(user.status).toBe('suspended');
      });

      it('should emit a UserSuspendedEvent', () => {
        user.suspend();
        const events = user.pullDomainEvents();
        expect(events).toEqual(expect.arrayContaining([expect.any(UserSuspendedEvent)]));
      });

      it('should emit the correct payload in UserSuspendedEvent', () => {
        user.suspend('user account on probation by store admin');
        const events = user.pullDomainEvents();
        expect(events).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              eventType: UserSuspendedEvent.EVENT_TYPE,
              payload: expect.objectContaining({
                userId: user.id.value,
                reason: 'user account on probation by store admin',
              }),
            }),
          ]),
        );
      });

      it('should allow reason to be optional in UserSuspendedEvent', () => {
        user.suspend();
        const [event] = user.pullDomainEvents() as UserSuspendedEvent[];
        expect(event.payload.reason).toBeUndefined();
      });
    });

    describe('idempotency checks', () => {
      it('should do nothing is account is already suspended', () => {
        const user = feUser.generateFromSnapshot({ status: 'suspended' });
        expect(() => user.suspend()).not.toThrow();
        expect(user.pullDomainEvents()).toHaveLength(0);
      });

      it('should emit event only once even if called multiple times', () => {
        const user = generateActiveUser();
        user.suspend();
        user.suspend();
        const events = user.pullDomainEvents();
        expect(events).toHaveLength(1);
      });
    });
  });

  describe('User.recordFailedLogin()', () => {
    describe('when user can authenticate', () => {
      it('should record failed login attempts', () => {
        const user = generateActiveUser();
        const initialAttempts = user.toSnapshot().security.failedLoginAttempts;
        user.recordFailedLogin();
        expect(user.toSnapshot().security.failedLoginAttempts).toBe(initialAttempts + 1);
      });

      it('should emit an event when max attempts reached', () => {
        const user = generateActiveUser();
        recordFailures(user, 9);
        user.recordFailedLogin();
        const events = user.pullDomainEvents();
        expect(events).toEqual(expect.arrayContaining([expect.any(UserLockedOutEvent)]));
        expect(events).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              payload: expect.objectContaining({
                userId: user.id.value,
                failedAttempts: 10,
              }),
            }),
          ]),
        );
      });
    });

    describe('when user can not authenticate', () => {
      let user: User;
      beforeEach(() => {
        user = feUser.generateFromSnapshot({ status: 'disabled' });
      });

      it('should not record failed login attempts', () => {
        const initialAttempts = user.toSnapshot().security.failedLoginAttempts;
        user.recordFailedLogin();
        expect(user.toSnapshot().security.failedLoginAttempts).toBe(initialAttempts);
      });

      it('should emit a AuthenticationBlockedEvent', () => {
        user.recordFailedLogin();
        const events = user.pullDomainEvents();
        expect(events).toEqual(expect.arrayContaining([expect.any(AuthenticationBlockedEvent)]));
      });

      it('should emit the correct payload in AuthenticationBlockedEvent', () => {
        user.recordFailedLogin();
        const events = user.pullDomainEvents();
        expect(events).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              eventType: AuthenticationBlockedEvent.EVENT_TYPE,
              payload: expect.objectContaining({
                userId: user.id.value,
                reason: 'account_disabled',
              }),
            }),
          ]),
        );
      });
    });
  });

  describe('User.recordSuccessfulLogin', () => {
    describe('when user can authenticate', () => {
      it('should record successful login', () => {
        const user = generateActiveUser();
        const initialAttemptAt = user.toSnapshot().security.lastLoginAttemptedAt;
        user.recordSuccessfulLogin();
        expect(user.toSnapshot().security.lastLoginAttemptedAt).not.toBe(initialAttemptAt);
      });

      it('should emit an event on successful login', () => {
        const user = generateActiveUser();
        user.recordSuccessfulLogin();
        const events = user.pullDomainEvents();
        expect(events).toEqual(expect.arrayContaining([expect.any(UserLoggedInEvent)]));
        expect(events).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              payload: expect.objectContaining({
                userId: user.id.value,
              }),
            }),
          ]),
        );
      });
    });

    describe('when user can not authenticate', () => {
      let user: User;
      beforeEach(() => {
        user = feUser.generateFromSnapshot({ status: 'disabled' });
      });

      it('should not record successful login attempts', () => {
        const initialAttemptAt = user.toSnapshot().security.lastLoginAttemptedAt;
        user.recordSuccessfulLogin();
        expect(user.toSnapshot().security.lastLoginAttemptedAt).toBe(initialAttemptAt);
      });

      it('should emit a AuthenticationBlockedEvent', () => {
        user.recordSuccessfulLogin();
        const events = user.pullDomainEvents();
        expect(events).toEqual(expect.arrayContaining([expect.any(AuthenticationBlockedEvent)]));
      });

      it('should emit the correct payload in AuthenticationBlockedEvent', () => {
        user.recordSuccessfulLogin();
        const events = user.pullDomainEvents();
        expect(events).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              eventType: AuthenticationBlockedEvent.EVENT_TYPE,
              payload: expect.objectContaining({
                userId: user.id.value,
                reason: 'account_disabled',
              }),
            }),
          ]),
        );
      });
    });
  });

  describe('User.startMfaSetup()', () => {
    it('should throw if user cannot perform actions', () => {
      const user = feUser.generateFromSnapshot();
      expect(() => user.startMfaSetup('email')).toThrow(UserNotActiveException);
    });

    it('should delegate totp MFA setup correctly', () => {
      const user = generateActiveUser();
      user.startMfaSetup('totp', Buffer.from('secret'), 'key-id');
      const security = user.toSnapshot().security;
      expect(security.mfaStatus).toEqual('pending');
    });

    it('should delegate email MFA setup correctly', () => {
      const user = generateActiveUser();
      user.startMfaSetup('email');
      const security = user.toSnapshot().security;
      expect(security.mfaStatus).toBe('enabled');
    });

    it('should require secret for totp setup', () => {
      const user = generateActiveUser();
      expect(() => user.startMfaSetup('totp')).toThrow(MfaSecretRequiredException);
    });
  });

  describe('User.completeMfaSetup', () => {
    it('should throw if user cannot perform actions', () => {
      const user = feUser.generateFromSnapshot();
      expect(() => user.completeMfaSetup()).toThrow(UserNotActiveException);
    });

    it('should throw if user is not in pending MFA setup state', () => {
      const user = generateActiveUser();
      expect(() => user.completeMfaSetup()).toThrow(MfaSetupNotInProgressException);
    });

    it('should complete MFA setup correctly', () => {
      const user = generateActiveUser();
      user.startMfaSetup('totp', Buffer.from('secret'), 'key-id');
      expect(user.toSnapshot().security.mfaStatus).toEqual('pending');
      user.completeMfaSetup();
      expect(user.toSnapshot().security.mfaStatus).toEqual('enabled');
    });
  });

  describe('User.disableMfa()', () => {
    it('should throw if user cannot perform actions', () => {
      const user = feUser.generateFromSnapshot();
      expect(() => user.disableMfa()).toThrow(UserNotActiveException);
    });

    it('should throw if user does not have MFA enabled', () => {
      const user = generateActiveUser();
      expect(() => user.disableMfa()).toThrow(MfaNotEnabledException);
    });

    it('should disable email MFA correctly', () => {
      const user = generateActiveUser();
      user.startMfaSetup('email');
      expect(user.toSnapshot().security.mfaStatus).toBe('enabled');
      user.disableMfa();
      expect(user.toSnapshot().security.mfaStatus).toBe('disabled');
    });

    it('should disable totp MFA correctly', () => {
      const user = generateActiveUser();
      user.startMfaSetup('totp', Buffer.from('secret'), 'key-id');
      user.completeMfaSetup();
      let security = user.toSnapshot().security;
      expect(security.mfaStatus).toBe('enabled');
      expect(security.mfaType).toBe('totp');
      expect(security.mfaSecretCiphertext).toEqual(Buffer.from('secret'));
      user.disableMfa();
      security = user.toSnapshot().security;
      expect(security.mfaStatus).toBe('disabled');
      expect(security.mfaType).toBeNull();
      expect(security.mfaSecretCiphertext).toBeNull();
    });
  });

  describe('User.recordMfaUse()', () => {
    it('should throw if user cannot perform actions', () => {
      const user = feUser.generateFromSnapshot();
      expect(() => user.recordMfaUse()).toThrow(UserNotActiveException);
    });

    it('should throw if user does not have MFA enabled', () => {
      const user = generateActiveUser();
      expect(() => user.recordMfaUse()).toThrow(MfaNotEnabledException);
    });

    it('should record MFA use correctly', () => {
      const user = generateActiveUser();
      user.startMfaSetup('email');
      const initialUsedAt = user.toSnapshot().security.mfaLastUsedAt;
      user.recordMfaUse();
      expect(user.toSnapshot().security.mfaLastUsedAt).not.toBe(initialUsedAt);
    });
  });

  describe('User.softDelete()', () => {
    it('should throw if user cannot perform actions', () => {
      const user = feUser.generateFromSnapshot();
      expect(() => user.softDelete()).toThrow(UserNotActiveException);
    });

    it('should set deletedAt timestamp', () => {
      const user = generateActiveUser();
      expect(user.toSnapshot().deletedAt).toBeNull();
      const now = new Date('2026-01-15T10:00:00Z');
      user.softDelete(now);
      expect(user.toSnapshot().deletedAt).toEqual(now);
    });

    it('should throw if user is already deleted', () => {
      const now = faker.date.past();
      const user = generateActiveUser({ deletedAt: now });
      expect(() => user.softDelete()).toThrow(UserNotActiveException);
    });
  });

  // ==== INVARIANTS ==============
  describe('User.ensureCanAuthenticate()', () => {
    it('should throw if user is pending', () => {
      const user = feUser.generate();
      expect(() => user.ensureCanAuthenticate()).toThrow(UserCannotAuthenticateException);
    });

    it('should throw if user is disabled', () => {
      const user = feUser.generateFromSnapshot({ status: 'disabled' });
      expect(() => user.ensureCanAuthenticate()).toThrow(UserCannotAuthenticateException);
    });

    it('should throw if user is locked out', () => {
      const user = generateActiveUser();
      recordFailures(user, 10);
      expect(() => user.ensureCanAuthenticate()).toThrow(UserCannotAuthenticateException);
    });

    it('should throw if user is deleted', () => {
      const user = feUser.generateFromSnapshot({ deletedAt: new Date() });
      expect(() => user.ensureCanAuthenticate()).toThrow(UserCannotAuthenticateException);
    });

    it('should not throw if user is active', () => {
      const user = generateActiveUser();
      expect(() => user.ensureCanAuthenticate()).not.toThrow();
    });
  });

  describe('User.ensureCanPerformActions()', () => {
    it('should throw if user status is not active', () => {
      const user = feUser.generate();
      expect(() => user.ensureCanPerformActions()).toThrow(UserNotActiveException);
    });

    it('should throw if user status is active but account is deleted', () => {
      const user = generateActiveUser({ deletedAt: new Date() });
      expect(() => user.ensureCanPerformActions()).toThrow(UserNotActiveException);
    });

    it('should not throw if user status is active and account is not deleted', () => {
      const user = generateActiveUser();
      expect(() => user.ensureCanPerformActions()).not.toThrow();
    });
  });

  describe('User.ensureStatusTransitionIsValid()', () => {
    it('should throw if transition is invalid e.g from pending -> disabled', () => {
      const user = feUser.generate();
      expect(() => user.ensureStatusTransitionIsValid('disabled')).toThrow(
        InvalidUserStatusTransitionException,
      );
    });

    it('should not throw if transition is valid', () => {
      const user = generateActiveUser();
      expect(() => user.ensureStatusTransitionIsValid('suspended')).not.toThrow();
    });
  });

  // ==== PREDICATES ==============
  describe('User.canAuthenticate()', () => {
    it('should return false with reason "account_pending" if user is pending', () => {
      const user = feUser.generate();
      const result = user.canAuthenticate();
      expect(result).toMatchObject({ allowed: false, reason: 'account_pending' });
    });

    it('should return false with reason "account_disabled" if user is disabled', () => {
      const user = feUser.generateFromSnapshot({ status: 'disabled' });
      const result = user.canAuthenticate();
      expect(result).toMatchObject({ allowed: false, reason: 'account_disabled' });
    });

    it('should return false with reason "locked_out" if user is locked out', () => {
      const user = generateActiveUser();
      recordFailures(user, 10);
      const result = user.canAuthenticate();
      expect(result).toMatchObject({ allowed: false, reason: 'locked_out' });
    });

    it('should return false with reason "account_deleted" if user is deleted', () => {
      const user = generateActiveUser({ deletedAt: new Date() });
      const result = user.canAuthenticate();
      expect(result).toMatchObject({ allowed: false, reason: 'account_deleted' });
    });

    it('should return true if user is active and not deleted', () => {
      const user = generateActiveUser();
      const result = user.canAuthenticate();
      expect(result).toMatchObject({ allowed: true });
    });
  });

  describe('User.canPerformActions()', () => {
    it('should return false if user status is not active', () => {
      const user = feUser.generate();
      const result = user.canPerformActions();
      expect(result).toBe(false);
    });

    it('should return false if user status is active but account is deleted', () => {
      const user = generateActiveUser({ deletedAt: new Date() });
      const result = user.canPerformActions();
      expect(result).toBe(false);
    });

    it('should return true if user status is active and account is not deleted', () => {
      const user = generateActiveUser();
      const result = user.canPerformActions();
      expect(result).toBe(true);
    });
  });

  // ==== SERIALIZATION ==============
  describe('UserSecurity.toSnapshot()', () => {
    const originalSnap = fsUser.generate({
      email: faker.internet.email(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      displayName: faker.person.fullName(),
      passwordHash: faker.string.alphanumeric(34),
      status: 'active',
    });

    it('should include all top-level properties in the snapshot', () => {
      const user = feUser.generateFromSnapshot(originalSnap);
      const snap = user.toSnapshot();
      expect(snap.id).toBeDefined();
      expect(snap.email).toBe(originalSnap.email);
      expect(snap.firstName).toBe(originalSnap.firstName);
      expect(snap.lastName).toBe(originalSnap.lastName);
      expect(snap.displayName).toBe(originalSnap.displayName);
      expect(snap.passwordHash).toBe(originalSnap.passwordHash);
      expect(snap.deletedAt).toBeNull();
    });

    it('should reflect mutations made after reconstitution', () => {
      const user = feUser.generateFromSnapshot(originalSnap);
      user.updateProfile({ firstName: 'UpdatedFirstName' });
      const snap = user.toSnapshot();
      expect(snap.firstName).toBe('UpdatedFirstName');
    });

    it('should serialize security metadata correctly', () => {
      const user = feUser.generateFromSnapshot(originalSnap);
      const snap = user.toSnapshot();
      expect(snap.security).toBeDefined();
      expect(snap.security.userId).toBe(originalSnap.id);
    });
  });
});
