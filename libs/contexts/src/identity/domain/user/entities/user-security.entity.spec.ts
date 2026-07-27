import { Duration, Instant } from '@app/shared-kernel';
import { feUserSecurity, fsUserSecurity } from '@app/testing/identity';
import { UserLockedOutEvent } from '../events/user-locked-out.event';
import { UserLoggedInEvent } from '../events/user-logged-in.event';
import {
  MfaAlreadyEnabledException,
  MfaNotEnabledException,
  MfaSecretRequiredException,
  MfaSetupInProgressException,
  MfaSetupNotInProgressException,
} from '../exceptions/security.exceptions';
import { UserSecurity } from './user-security.entity';

const USER_ID = 'user-uuid-001';
const SECRET = Buffer.from('totp-secret');
const KID = 'key-v1';
const NOW = Instant.parse('2024-01-01T00:00:00Z');

const recordFailures = (security: UserSecurity, count: number, now: Instant) => {
  for (let i = 0; i < count; i++) security.recordFailedLogin(now);
};

describe('UserSecurity Domain Entity', () => {
  // ==== FACTORY ==============
  describe('UserSecurity.create()', () => {
    let security = feUserSecurity.generate();

    it('should create a user security entity with the correct properties', () => {
      expect(security.userId).toBeDefined();
      expect(security.failedLoginAttempts).toBeDefined();
      expect(security.mfaStatus).toBeDefined();
      expect(security.mfaType).toBeNull();
      expect(security.lockoutUntil).toBeNull();
    });

    it('should create a user security entity with the correct user id', () => {
      security = feUserSecurity.generate({ userId: USER_ID });
      expect(security.userId).toBe(USER_ID);
    });
  });

  describe('UserSecurity.reconstitute()', () => {
    it('should restore all fields from snapshot', () => {
      const snapshot = fsUserSecurity.generate({
        failedLoginAttempts: 3,
        lastLoginAttemptedAt: NOW,
        mfaStatus: 'enabled',
        mfaType: 'totp',
        mfaSecretCiphertext: SECRET,
        mfaSecretKid: KID,
        mfaEnabledAt: NOW,
      });
      const security = UserSecurity.reconstitute(snapshot);
      expect(security.failedLoginAttempts).toBe(3);
      expect(security.mfaStatus).toBe('enabled');
      expect(security.mfaType).toBe('totp');
    });

    it('should round-trip through toSnapshot() without data loss', () => {
      const original = fsUserSecurity.generate({
        failedLoginAttempts: 5,
        mfaStatus: 'pending',
        mfaType: 'totp',
        mfaSecretCiphertext: SECRET,
        mfaSecretKid: KID,
      });
      const result = UserSecurity.reconstitute(original).toSnapshot();
      expect(result).toEqual(original);
    });
  });

  // ==== COMMANDS ==============
  describe('UserSecurity.recordFailedLogin()', () => {
    let security: UserSecurity;
    beforeEach(() => {
      security = feUserSecurity.generate();
    });

    it('should increment failedLoginAttempts by one', () => {
      security.recordFailedLogin(NOW);
      expect(security.failedLoginAttempts).toBe(1);
    });

    it('should return an empty array before the lockout threshold', () => {
      const events = security.recordFailedLogin(NOW);
      expect(events).toHaveLength(0);
    });

    it('should set lastLoginAttemptedAt on each call', () => {
      security.recordFailedLogin(NOW);
      expect(security.toSnapshot().lastLoginAttemptedAt?.toEpochMs()).toEqual(NOW.toEpochMs());
    });

    it('should lock out after exactly 10 failed attempts', () => {
      recordFailures(security, 9, NOW);
      expect(security.isLockedOut(NOW)).toBe(false);
      security.recordFailedLogin(NOW);
      expect(security.isLockedOut(NOW)).toBe(true);
    });

    it('should return a UserLockedOutEvent on the 10th attempt', () => {
      recordFailures(security, 9, NOW);
      const events = security.recordFailedLogin(NOW);
      expect(events).toEqual(expect.arrayContaining([expect.any(UserLockedOutEvent)]));
    });

    it('should return event with correct payload', () => {
      recordFailures(security, 9, NOW);
      const events = security.recordFailedLogin(NOW);
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            eventType: UserLockedOutEvent.EVENT_TYPE,
            payload: expect.objectContaining({
              userId: security.userId,
              failedAttempts: 10,
              lockoutUntil: expect.any(Instant),
            }),
          }),
        ]),
      );
    });

    it('should not increment attempts when already locked out', () => {
      recordFailures(security, 10, NOW);
      const countAfterLockout = security.failedLoginAttempts;
      security.recordFailedLogin(NOW);
      security.recordFailedLogin(NOW);
      expect(security.failedLoginAttempts).toBe(countAfterLockout);
    });

    it('should return empty array when call is skipped due to existing lockout', () => {
      recordFailures(security, 10, NOW);
      const events = security.recordFailedLogin(NOW);
      expect(events).toHaveLength(0);
    });
  });

  describe('UserSecurity.recordSuccessfulLogin()', () => {
    it('should set lastLoginAttemptedAt', () => {
      const security = feUserSecurity.generate();
      security.recordSuccessfulLogin(NOW);
      expect(security.toSnapshot().lastLoginAttemptedAt?.toEpochMs()).toEqual(NOW.toEpochMs());
    });

    it('should reset lockout state after a successful login', () => {
      const security = feUserSecurity.generate();
      recordFailures(security, 10, NOW);
      expect(security.isLockedOut(NOW)).toBe(true);
      security.recordSuccessfulLogin(NOW);
      expect(security.isLockedOut(NOW)).toBe(false);
      expect(security.failedLoginAttempts).toBe(0);
      expect(security.toSnapshot().lockoutReason).toBeNull();
    });

    it('should return a UserLoggedInEvent when login is successful', () => {
      const security = feUserSecurity.generate();
      const events = security.recordSuccessfulLogin(NOW);
      expect(events).toEqual(expect.arrayContaining([expect.any(UserLoggedInEvent)]));
    });

    it('should return event with correct payload', () => {
      const security = feUserSecurity.generate();
      const events = security.recordSuccessfulLogin(NOW);
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            eventType: UserLoggedInEvent.EVENT_TYPE,
            payload: expect.objectContaining({
              userId: security.userId,
            }),
          }),
        ]),
      );
    });
  });

  describe('UserSecurity.recordPasswordChange()', () => {
    it('should set lastPasswordChangeAt', () => {
      const security = feUserSecurity.generate();
      security.recordPasswordChange(NOW);
      expect(security.toSnapshot().lastPasswordChangeAt?.toEpochMs()).toEqual(NOW.toEpochMs());
    });

    it('should reset lockout state after a successful password change', () => {
      const security = feUserSecurity.generate();
      recordFailures(security, 10, NOW);
      expect(security.isLockedOut(NOW)).toBe(true);
      security.recordPasswordChange(NOW);
      expect(security.isLockedOut(NOW)).toBe(false);
      expect(security.failedLoginAttempts).toBe(0);
      expect(security.toSnapshot().lockoutReason).toBeNull();
    });
  });

  describe('UserSecurity.startMfaSetup()', () => {
    describe('guards', () => {
      it('should throw when already enabled', () => {
        const security = UserSecurity.reconstitute(
          fsUserSecurity.generate({ mfaStatus: 'enabled' }),
        );
        expect(() => security.startMfaSetup(NOW, 'totp', SECRET, KID)).toThrow(
          MfaAlreadyEnabledException,
        );
      });

      it('should throw when already pending', () => {
        const security = feUserSecurity.generate();
        security.startMfaSetup(NOW, 'totp', SECRET, KID);
        expect(() => security.startMfaSetup(NOW, 'totp', SECRET, KID)).toThrow(
          MfaSetupInProgressException,
        );
      });
    });

    describe('when type is email', () => {
      it('should enable MFA immediately without needing a secret', () => {
        const security = feUserSecurity.generate();
        security.startMfaSetup(NOW, 'email');
        expect(security.mfaStatus).toBe('enabled');
        expect(security.mfaType).toBe('email');
        expect(security.toSnapshot().mfaEnabledAt).not.toBeNull();
      });

      it('should not store a secret for email MFA even when provided', () => {
        const security = feUserSecurity.generate();
        security.startMfaSetup(NOW, 'email', Buffer.alloc(5), 'test-kid');
        const snapshot = security.toSnapshot();
        expect(snapshot.mfaSecretCiphertext).toBeNull();
        expect(snapshot.mfaSecretKid).toBeNull();
      });
    });

    describe('when type is totp', () => {
      it('should throw if secret is missing', () => {
        const security = feUserSecurity.generate();
        expect(() => security.startMfaSetup(NOW, 'totp')).toThrow(MfaSecretRequiredException);
      });

      it('should throw if kid is missing', () => {
        const security = feUserSecurity.generate();
        expect(() => security.startMfaSetup(NOW, 'totp', SECRET)).toThrow(
          MfaSecretRequiredException,
        );
      });

      it('should start MFA setup in pending state with secrets', () => {
        const security = feUserSecurity.generate();
        security.startMfaSetup(NOW, 'totp', SECRET, KID);
        const snapshot = security.toSnapshot();
        expect(security.mfaStatus).toBe('pending');
        expect(security.mfaType).toBe('totp');
        expect(snapshot.mfaSecretCiphertext).toEqual(SECRET);
        expect(snapshot.mfaSecretKid).toBe(KID);
      });
    });
  });

  describe('UserSecurity.completeMfaSetup()', () => {
    describe('guards', () => {
      it('should throw if MFA setup is not in progress', () => {
        const security = feUserSecurity.generate();
        expect(() => security.completeMfaSetup(NOW)).toThrow(MfaSetupNotInProgressException);
      });

      it('should throw if MFA is already enabled', () => {
        const security = feUserSecurity.generateFromSnapshot({ mfaStatus: 'enabled' });
        expect(() => security.completeMfaSetup(NOW)).toThrow(MfaAlreadyEnabledException);
      });
    });

    describe('when setup is pending', () => {
      it('should complete setup and enables MFA', () => {
        const security = feUserSecurity.generate();
        security.startMfaSetup(NOW, 'totp', SECRET, KID);
        security.completeMfaSetup(NOW);
        expect(security.isMfaEnabled()).toBe(true);
        expect(security.toSnapshot().mfaEnabledAt).not.toBeNull();
      });

      it('should not be completed twice', () => {
        const security = feUserSecurity.generate();
        security.startMfaSetup(NOW, 'totp', SECRET, KID);
        security.completeMfaSetup(NOW);
        expect(() => security.completeMfaSetup(NOW)).toThrow(MfaAlreadyEnabledException);
      });
    });
  });

  describe('UserSecurity.disableMfa()', () => {
    describe('guards', () => {
      it('should throw if MFA not enabled', () => {
        const security = feUserSecurity.generate();
        expect(() => security.disableMfa()).toThrow(MfaNotEnabledException);
      });

      it('should throw if MFA setup is pending', () => {
        const security = feUserSecurity.generate();
        security.startMfaSetup(NOW, 'totp', SECRET, KID);
        expect(() => security.disableMfa()).toThrow(MfaNotEnabledException);
      });
    });

    describe('when MFA is enabled', () => {
      it('should disable MFA and clear configuration', () => {
        const security = feUserSecurity.generateFromSnapshot({
          mfaStatus: 'enabled',
          mfaType: 'totp',
          mfaSecretCiphertext: SECRET,
          mfaSecretKid: KID,
          mfaEnabledAt: NOW,
        });
        security.disableMfa();
        const snapshot = security.toSnapshot();
        expect(security.mfaStatus).toBe('disabled');
        expect(security.isMfaEnabled()).toBe(false);
        expect(security.mfaType).toBeNull();
        expect(snapshot.mfaSecretCiphertext).toBeNull();
        expect(snapshot.mfaSecretKid).toBeNull();
      });
    });
  });

  describe('UserSecurity.recordMfaUsed()', () => {
    it('should throw if MFA is not enabled', () => {
      const security = feUserSecurity.generate();
      expect(() => security.recordMfaUsed(NOW)).toThrow(MfaNotEnabledException);
    });

    it('should update mfaLastUsedAt', () => {
      const security = feUserSecurity.generateFromSnapshot({ mfaStatus: 'enabled' });
      security.recordMfaUsed(NOW);
      expect(security.toSnapshot().mfaLastUsedAt?.toEpochMs()).toBe(NOW.toEpochMs());
    });
  });

  // ==== PREDICATES ==============
  describe('UserSecurity.isMfaEnabled()', () => {
    it('should return false when status is disabled', () => {
      const security = feUserSecurity.generate();
      expect(security.isMfaEnabled()).toBe(false);
    });

    it('should return false when status is pending', () => {
      const security = feUserSecurity.generateFromSnapshot({ mfaStatus: 'pending' });
      expect(security.isMfaEnabled()).toBe(false);
    });

    it('should return true when status is enabled', () => {
      const security = feUserSecurity.generateFromSnapshot({ mfaStatus: 'enabled' });
      expect(security.isMfaEnabled()).toBe(true);
    });
  });

  describe('UserSecurity.isLockedOut()', () => {
    it('should return false when lockoutUntil is null', () => {
      const security = feUserSecurity.generate();
      expect(security.isLockedOut(NOW)).toBe(false);
    });

    it('should return true when lockoutUntil is in the future', () => {
      const future = NOW.plus(Duration.hours(1));
      const security = feUserSecurity.generateFromSnapshot({ lockoutUntil: future });
      expect(security.isLockedOut(NOW)).toBe(true);
    });

    it('should return false when lockoutUntil is in the past', () => {
      const past = NOW.minus(Duration.minutes(1));
      const security = feUserSecurity.generateFromSnapshot({ lockoutUntil: past });
      expect(security.isLockedOut(NOW)).toBe(false);
    });

    it('should accept an explicit "now" reference date', () => {
      const lockoutUntil = Instant.parse('2030-01-01T00:00:00Z');
      const security = feUserSecurity.generateFromSnapshot({ lockoutUntil });
      const before = Instant.parse('2029-12-31T23:59:59Z');
      const after = Instant.parse('2030-01-01T00:00:01Z');
      expect(security.isLockedOut(before)).toBe(true);
      expect(security.isLockedOut(after)).toBe(false);
    });
  });

  // ==== SERIALIZATION ==============
  describe('UserSecurity.toSnapshot()', () => {
    it('should include userId in the snapshot', () => {
      const security = feUserSecurity.generate({ userId: USER_ID });
      expect(security.toSnapshot().userId).toBe(USER_ID);
    });

    it('should reflect mutations made after reconstitution', () => {
      const security = feUserSecurity.generate();
      recordFailures(security, 4, NOW);
      expect(security.toSnapshot().failedLoginAttempts).toBe(4);
    });
  });
});
