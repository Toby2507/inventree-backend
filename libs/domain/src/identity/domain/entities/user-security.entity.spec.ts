import { feUserSecurity, fsUserSecurity } from '@app/testing';
import { UserLockedOutEvent } from '../events';
import {
  MfaAlreadyEnabledException,
  MfaNotEnabledException,
  MfaSecretRequiredException,
  MfaSetupInProgressException,
  MfaSetupNotInProgressException,
} from '../exceptions';
import { UserSecurity, UserSecuritySnapshot } from './user-security.entity';

// ─── Helpers ────────────────────────────────────────────────────────────────

const makeSnapshot = (overrides: Partial<UserSecuritySnapshot> = {}): UserSecuritySnapshot => ({
  userId: USER_ID,
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
  ...overrides,
});

const USER_ID = 'user-uuid-001';
const SECRET = Buffer.from('totp-secret');
const KID = 'key-v1';

// Exhaust attempts without triggering lockout (stops one short)
const recordFailures = (security: UserSecurity, count: number, now?: Date) => {
  for (let i = 0; i < count; i++) security.recordFailedLogin(now);
};

describe('UserSecurity Domain Entity', () => {
  // ==== FACTORY ==============
  describe('create()', () => {
    let security = feUserSecurity.generate();

    it('initialises with zero failed attempts', () => {
      expect(security.failedLoginAttempts).toBe(0);
    });

    it('initialises mfaStatus as disabled', () => {
      expect(security.mfaStatus).toBe('disabled');
    });

    it('initialises lockoutUntil as null', () => {
      expect(security.lockoutUntil).toBeNull();
    });

    it('sets userId correctly', () => {
      security = feUserSecurity.generate({ userId: USER_ID });
      expect(security.userId).toBe(USER_ID);
    });
  });

  describe('reconstitute()', () => {
    it('restores all fields from snapshot', () => {
      const now = new Date();
      const snapshot = fsUserSecurity.generate({
        failedLoginAttempts: 3,
        lastLoginAttemptedAt: now,
        mfaStatus: 'enabled',
        mfaType: 'totp',
        mfaSecretCiphertext: SECRET,
        mfaSecretKid: KID,
        mfaEnabledAt: now,
      });
      const security = UserSecurity.reconstitute(snapshot);
      expect(security.failedLoginAttempts).toBe(3);
      expect(security.mfaStatus).toBe('enabled');
      expect(security.mfaType).toBe('totp');
    });

    it('round-trips through toSnapshot() without data loss', () => {
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
  describe('recordFailedLogin()', () => {
    let security: UserSecurity;
    beforeEach(() => {
      security = feUserSecurity.generate();
    });

    it('increments failedLoginAttempts by one', () => {
      security.recordFailedLogin();
      expect(security.failedLoginAttempts).toBe(1);
    });

    it('returns an empty array before the lockout threshold', () => {
      const events = security.recordFailedLogin();
      expect(events).toHaveLength(0);
    });

    it('sets lastLoginAttemptedAt on each call', () => {
      const now = new Date('2026-01-01T10:00:00Z');
      security.recordFailedLogin(now);
      expect(security.toSnapshot().lastLoginAttemptedAt).toEqual(now);
    });

    it('locks out after exactly 10 failed attempts', () => {
      recordFailures(security, 9);
      expect(security.isLockedOut()).toBe(false);
      security.recordFailedLogin();
      expect(security.isLockedOut()).toBe(true);
    });

    it('returns a UserLockedOutEvent on the 10th attempt', () => {
      recordFailures(security, 9);
      const events = security.recordFailedLogin();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(UserLockedOutEvent);
    });

    it('UserLockedOutEvent carries correct payload', () => {
      const now = new Date('2026-06-01T12:00:00Z');
      recordFailures(security, 9, now);
      const events = security.recordFailedLogin(now);
      const event = events[0] as UserLockedOutEvent;
      expect(event.payload.userId).toBe(security.userId);
      expect(event.payload.failedAttempts).toBe(10);
      expect(event.payload.occurredAt).toEqual(now);
      expect(event.payload.lockoutUntil.getTime()).toBe(now.getTime() + 30 * 60 * 1000);
    });

    it('does not increment attempts when already locked out', () => {
      recordFailures(security, 10);
      const countAfterLockout = security.failedLoginAttempts;
      security.recordFailedLogin();
      security.recordFailedLogin();
      expect(security.failedLoginAttempts).toBe(countAfterLockout);
    });

    it('returns empty array when call is skipped due to existing lockout', () => {
      recordFailures(security, 10);
      const events = security.recordFailedLogin();
      expect(events).toHaveLength(0);
    });
  });

  describe('recordSuccessfulLogin()', () => {
    it('sets lastLoginAttemptedAt', () => {
      const security = feUserSecurity.generate();
      const now = new Date('2026-04-01T09:30:00Z');
      security.recordSuccessfulLogin(now);
      expect(security.toSnapshot().lastLoginAttemptedAt).toEqual(now);
    });

    it('resets lockout state after a successful login', () => {
      const security = feUserSecurity.generate();
      recordFailures(security, 10);
      expect(security.isLockedOut()).toBe(true);
      security.recordSuccessfulLogin();
      expect(security.isLockedOut()).toBe(false);
      expect(security.failedLoginAttempts).toBe(0);
      expect(security.toSnapshot().lockoutReason).toBeNull();
    });
  });

  describe('recordPasswordChange()', () => {
    it('sets lastPasswordChangeAt', () => {
      const security = feUserSecurity.generate();
      const now = new Date('2026-05-10T08:00:00Z');
      security.recordPasswordChange(now);
      expect(security.toSnapshot().lastPasswordChangeAt).toEqual(now);
    });

    it('resets lockout state after a successful password change', () => {
      const security = feUserSecurity.generate();
      recordFailures(security, 10);
      expect(security.isLockedOut()).toBe(true);
      security.recordPasswordChange();
      expect(security.isLockedOut()).toBe(false);
      expect(security.failedLoginAttempts).toBe(0);
      expect(security.toSnapshot().lockoutReason).toBeNull();
    });
  });

  describe('startMfaSetup()', () => {
    describe('guards', () => {
      it('throws MfaAlreadyEnabledException when already enabled', () => {
        const security = UserSecurity.reconstitute(
          fsUserSecurity.generate({ mfaStatus: 'enabled' }),
        );
        expect(() => security.startMfaSetup('totp', SECRET, KID)).toThrow(
          MfaAlreadyEnabledException,
        );
      });

      it('throws MfaSetupInProgressException when already pending', () => {
        const security = feUserSecurity.generate();
        security.startMfaSetup('totp', SECRET, KID);
        expect(() => security.startMfaSetup('totp', SECRET, KID)).toThrow(
          MfaSetupInProgressException,
        );
      });
    });

    describe('when type is email', () => {
      it('enables MFA immediately without needing a secret', () => {
        const security = feUserSecurity.generate();
        security.startMfaSetup('email');
        expect(security.mfaStatus).toBe('enabled');
        expect(security.mfaType).toBe('email');
        expect(security.toSnapshot().mfaEnabledAt).not.toBeNull();
      });

      it('does not store a secret for email MFA even when provided', () => {
        const security = feUserSecurity.generate();
        security.startMfaSetup('email', Buffer.alloc(5), 'test-kid');
        const snapshot = security.toSnapshot();
        expect(snapshot.mfaSecretCiphertext).toBeNull();
        expect(snapshot.mfaSecretKid).toBeNull();
      });
    });

    describe('when type is totp', () => {
      it('throws if secret is missing', () => {
        const security = feUserSecurity.generate();
        expect(() => security.startMfaSetup('totp')).toThrow(MfaSecretRequiredException);
      });

      it('throws if kid is missing', () => {
        const security = feUserSecurity.generate();
        expect(() => security.startMfaSetup('totp', SECRET)).toThrow(MfaSecretRequiredException);
      });

      it('starts MFA setup in pending state with secrets', () => {
        const security = feUserSecurity.generate();
        security.startMfaSetup('totp', SECRET, KID);
        const snapshot = security.toSnapshot();
        expect(security.mfaStatus).toBe('pending');
        expect(security.mfaType).toBe('totp');
        expect(snapshot.mfaSecretCiphertext).toEqual(SECRET);
        expect(snapshot.mfaSecretKid).toBe(KID);
      });
    });
  });

  describe('completeMfaSetup()', () => {
    describe('guards', () => {
      it('throws if MFA setup is not in progress', () => {
        const security = feUserSecurity.generate();
        expect(() => security.completeMfaSetup()).toThrow(MfaSetupNotInProgressException);
      });

      it('throws if MFA is already enabled', () => {
        const security = UserSecurity.reconstitute(
          fsUserSecurity.generate({ mfaStatus: 'enabled' }),
        );
        expect(() => security.completeMfaSetup()).toThrow(MfaAlreadyEnabledException);
      });
    });

    describe('when setup is pending', () => {
      it('completes setup and enables MFA', () => {
        const security = feUserSecurity.generate();
        security.startMfaSetup('totp', SECRET, KID);
        security.completeMfaSetup();
        expect(security.isMfaEnabled()).toBe(true);
        expect(security.toSnapshot().mfaEnabledAt).not.toBeNull();
      });

      it('cannot be completed twice', () => {
        const security = feUserSecurity.generate();
        security.startMfaSetup('totp', SECRET, KID);
        security.completeMfaSetup();
        expect(() => security.completeMfaSetup()).toThrow(MfaAlreadyEnabledException);
      });
    });
  });

  describe('disableMfa()', () => {
    describe('guards', () => {
      it('throws if MFA not enabled', () => {
        const security = feUserSecurity.generate();
        expect(() => security.disableMfa()).toThrow(MfaNotEnabledException);
      });

      it('throws if MFA setup is pending', () => {
        const security = feUserSecurity.generate();
        security.startMfaSetup('totp', SECRET, KID);
        expect(() => security.disableMfa()).toThrow(MfaNotEnabledException);
      });
    });

    describe('when MFA is enabled', () => {
      it('disables MFA and clears configuration', () => {
        const security = UserSecurity.reconstitute(
          makeSnapshot({
            mfaStatus: 'enabled',
            mfaType: 'totp',
            mfaSecretCiphertext: SECRET,
            mfaSecretKid: KID,
            mfaEnabledAt: new Date(),
          }),
        );
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

  describe('recordMfaUsed()', () => {
    it('throws if MFA is not enabled', () => {
      const security = feUserSecurity.generate();
      expect(() => security.recordMfaUsed()).toThrow(MfaNotEnabledException);
    });

    it('updates mfaLastUsedAt', () => {
      const security = UserSecurity.reconstitute(makeSnapshot({ mfaStatus: 'enabled' }));
      const now = new Date('2026-04-01T00:00:00Z');
      security.recordMfaUsed(now);
      expect(security.toSnapshot().mfaLastUsedAt).toEqual(now);
    });
  });

  // ==== PREDICATES ==============
  describe('isMfaEnabled()', () => {
    it('returns false when status is disabled', () => {
      const security = feUserSecurity.generate();
      expect(security.isMfaEnabled()).toBe(false);
    });

    it('returns false when status is pending', () => {
      const security = UserSecurity.reconstitute(fsUserSecurity.generate({ mfaStatus: 'pending' }));
      expect(security.isMfaEnabled()).toBe(false);
    });

    it('returns true when status is enabled', () => {
      const security = UserSecurity.reconstitute(fsUserSecurity.generate({ mfaStatus: 'enabled' }));
      expect(security.isMfaEnabled()).toBe(true);
    });
  });

  describe('isLockedOut()', () => {
    it('returns false when lockoutUntil is null', () => {
      const security = feUserSecurity.generate();
      expect(security.isLockedOut()).toBe(false);
    });

    it('returns true when lockoutUntil is in the future', () => {
      const future = new Date(Date.now() + 60000);
      const security = UserSecurity.reconstitute(fsUserSecurity.generate({ lockoutUntil: future }));
      expect(security.isLockedOut()).toBe(true);
    });

    it('returns false when lockoutUntil is in the past', () => {
      const past = new Date(Date.now() - 1000);
      const security = UserSecurity.reconstitute(fsUserSecurity.generate({ lockoutUntil: past }));
      expect(security.isLockedOut()).toBe(false);
    });

    it('accepts an explicit "now" reference date', () => {
      const lockoutUntil = new Date('2030-01-01T00:00:00Z');
      const security = UserSecurity.reconstitute(fsUserSecurity.generate({ lockoutUntil }));
      const before = new Date('2029-12-31T23:59:59Z');
      const after = new Date('2030-01-01T00:00:01Z');
      expect(security.isLockedOut(before)).toBe(true);
      expect(security.isLockedOut(after)).toBe(false);
    });
  });

  // ==== SERIALIZATION ==============
  describe('toSnapshot()', () => {
    it('includes userId in the snapshot', () => {
      const security = feUserSecurity.generate({ userId: USER_ID });
      expect(security.toSnapshot().userId).toBe(USER_ID);
    });

    it('snapshot reflects mutations made after reconstitution', () => {
      const security = feUserSecurity.generate();
      recordFailures(security, 4);
      expect(security.toSnapshot().failedLoginAttempts).toBe(4);
    });
  });
});
