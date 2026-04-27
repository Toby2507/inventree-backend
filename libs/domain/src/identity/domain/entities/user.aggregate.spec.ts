import { feUser, fsUser } from '@app/testing';
import { UserEmailVerifiedEvent, UserRegisteredEvent } from '../events';
import { PhoneNotProvidedException } from '../exceptions';
import { User } from './user.aggregate';

describe('User Aggregate Root', () => {
  // ==== FACTORY ==============
  describe('User.create()', () => {
    const user = feUser.generate();

    it('should create a user with the correct properties', () => {
      expect(user.id).toBeDefined();
      expect(user.email).toBeDefined();
      expect(user.firstName).toBeNull();
      expect(user.lastName).toBeNull();
      expect(user.displayName).toBeNull();
      expect(user.passwordHash).toBeDefined();
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
      expect(user.firstName).toBe('John');
      expect(user.lastName).toBe('Doe');
      expect(user.displayName).toBe('John Doe');
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
            eventType: 'identity.user.registered',
            payload: expect.objectContaining({
              userId: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
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
      expect(user.firstName).toBe('John');
      expect(user.lastName).toBe('Doe');
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
    it('should mark isEmailVerified as true', () => {
      const user = feUser.generate();
      user.verifyEmail();
      expect(user.isEmailVerified).toBe(true);
    });

    it('should emit a UserEmailVerifiedEvent', () => {
      const user = feUser.generateFromSnapshot();
      user.verifyEmail();
      const events = user.pullDomainEvents();
      expect(events).toEqual(expect.arrayContaining([expect.any(UserEmailVerifiedEvent)]));
    });

    it('should emit the correct payload in UserEmailVerifiedEvent', () => {
      const user = feUser.generateFromSnapshot();
      const now = new Date('2026-01-15T10:00:00Z');
      user.verifyEmail(now);
      const events = user.pullDomainEvents();
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            eventType: 'identity.user.email_verified',
            payload: expect.objectContaining({
              userId: user.id,
              email: user.email,
              verifiedAt: now,
            }),
          }),
        ]),
      );
    });

    it('should be idempotent if already verified', () => {
      const user = feUser.generateFromSnapshot({ emailVerifiedAt: new Date() });
      expect(() => user.verifyEmail()).not.toThrow();
      expect(user.pullDomainEvents()).toHaveLength(0);
    });

    it('should emit event only once even if called multiple times', () => {
      const user = feUser.generateFromSnapshot();
      user.verifyEmail();
      user.verifyEmail();
      const events = user.pullDomainEvents();
      expect(events).toHaveLength(1);
    });
  });

  describe('User.verifyPhone()', () => {
    it('should throw when phone number is not available', () => {
      const user = feUser.generateFromSnapshot();
      expect(() => user.verifyPhone()).toThrow(PhoneNotProvidedException);
    });

    it('should mark isPhoneVerified as true', () => {
      const user = feUser.generateFromSnapshot({ phone: '+2349058731812' });
      user.verifyPhone();
      expect(user.isPhoneVerified).toBe(true);
    });

    it('should be idempotent if already verified', () => {
      const user = feUser.generateFromSnapshot({
        phone: '+2349058731812',
        phoneVerifiedAt: new Date(),
      });
      expect(() => user.verifyPhone()).not.toThrow();
    });

    it('should be callable multiple times without throwing', () => {
      const user = feUser.generateFromSnapshot({ phone: '+2349058731812' });
      user.verifyPhone();
      user.verifyPhone();
      expect(user.isPhoneVerified).toBe(true);
    });
  });

  describe('User.changePassword()', () => {
    it('should update the passwordHash', () => {
      const user = feUser.generate();
      user.changePassword('new-hash');
      expect(user.passwordHash).toBe('new-hash');
    });

    it('should update security metadata when password changes', () => {
      const user = feUser.generate();
      user.changePassword('new-hash');
      const security = user.toSnapshot().security;
      expect(security.lastPasswordChangeAt).not.toBeNull();
    });
  });
});
