import { fdUser, fdUserSecurity, feUser } from '@app/testing/identity';
import { UserMapper } from './user.mapper';

describe('User Mapper', () => {
  let mapper: UserMapper;
  beforeEach(() => {
    mapper = new UserMapper();
  });

  describe('UserMapper.toDomain()', () => {
    it('should map persistence data to domain aggregate', () => {
      const raw = { user: fdUser.generate(), security: fdUserSecurity.generate() };
      const user = mapper.toDomain(raw);
      const snapshot = user.toSnapshot();
      expect(snapshot.id).toBe(raw.user.id);
      expect(snapshot.email).toBe(raw.user.email);
      expect(snapshot.emailVerifiedAt).toBe(raw.user.email_verified_at);
      expect(snapshot.phone).toBe(raw.user.phone);
      expect(snapshot.phoneVerifiedAt).toBe(raw.user.phone_verified_at);
      expect(snapshot.passwordHash).toBe(raw.user.password_hash);
      expect(snapshot.firstName).toBe(raw.user.first_name);
      expect(snapshot.lastName).toBe(raw.user.last_name);
      expect(snapshot.displayName).toBe(raw.user.display_name);
      expect(snapshot.status).toBe(raw.user.status);
      expect(snapshot.createdAt).toBe(raw.user.created_at);
      expect(snapshot.deletedAt).toBe(raw.user.deleted_at);
      expect(snapshot.security.userId).toBe(raw.security.user_id);
      expect(snapshot.security.failedLoginAttempts).toBe(raw.security.failed_login_attempts);
      expect(snapshot.security.lastLoginAttemptedAt).toBe(raw.security.last_login_attempted_at);
      expect(snapshot.security.lastPasswordChangeAt).toBe(raw.security.last_password_change_at);
      expect(snapshot.security.lockoutReason).toBe(raw.security.lockout_reason);
      expect(snapshot.security.lockoutUntil).toBe(raw.security.lockout_until);
      expect(snapshot.security.mfaEnabledAt).toBe(raw.security.mfa_enabled_at);
      expect(snapshot.security.mfaLastUsedAt).toBe(raw.security.mfa_last_used_at);
      expect(snapshot.security.mfaSecretCiphertext).toBe(raw.security.mfa_secret_ciphertext);
      expect(snapshot.security.mfaSecretKid).toBe(raw.security.mfa_secret_kid);
      expect(snapshot.security.mfaStatus).toBe(raw.security.mfa_status);
      expect(snapshot.security.mfaType).toBe(raw.security.mfa_type);
    });

    it('should map null values correctly', () => {
      const raw = {
        user: fdUser.generate({ email_verified_at: null, phone: null, phone_verified_at: null }),
        security: fdUserSecurity.generate({ lockout_until: null }),
      };
      const user = mapper.toDomain(raw);
      const snapshot = user.toSnapshot();
      expect(snapshot.emailVerifiedAt).toBeNull();
      expect(snapshot.phone).toBeNull();
      expect(snapshot.phoneVerifiedAt).toBeNull();
      expect(snapshot.security.lockoutUntil).toBeNull();
    });
  });

  describe('UserMapper.toPersistence()', () => {
    it('should map domain aggregate to persistence data', () => {
      const userEntity = feUser.generate();
      const userSnap = userEntity.toSnapshot();
      const { user, security } = mapper.toPersistence(userEntity);
      expect(user.id).toBe(userSnap.id);
      expect(user.email).toBe(userSnap.email);
      expect(user.email_verified_at).toBe(userSnap.emailVerifiedAt);
      expect(user.phone).toBe(userSnap.phone);
      expect(user.phone_verified_at).toBe(userSnap.phoneVerifiedAt);
      expect(user.password_hash).toBe(userSnap.passwordHash);
      expect(user.first_name).toBe(userSnap.firstName);
      expect(user.last_name).toBe(userSnap.lastName);
      expect(user.display_name).toBe(userSnap.displayName);
      expect(user.status).toBe(userSnap.status);
      expect(user.created_at).toBe(userSnap.createdAt);
      expect(user.deleted_at).toBe(userSnap.deletedAt);
      expect(security.user_id).toBe(userSnap.security.userId);
      expect(security.failed_login_attempts).toBe(userSnap.security.failedLoginAttempts);
      expect(security.last_login_attempted_at).toBe(userSnap.security.lastLoginAttemptedAt);
      expect(security.last_password_change_at).toBe(userSnap.security.lastPasswordChangeAt);
      expect(security.lockout_reason).toBe(userSnap.security.lockoutReason);
      expect(security.lockout_until).toBe(userSnap.security.lockoutUntil);
      expect(security.mfa_enabled_at).toBe(userSnap.security.mfaEnabledAt);
      expect(security.mfa_last_used_at).toBe(userSnap.security.mfaLastUsedAt);
      expect(security.mfa_secret_ciphertext).toBe(userSnap.security.mfaSecretCiphertext);
      expect(security.mfa_secret_kid).toBe(userSnap.security.mfaSecretKid);
      expect(security.mfa_status).toBe(userSnap.security.mfaStatus);
      expect(security.mfa_type).toBe(userSnap.security.mfaType);
    });

    it('should map null values correctly in persistence data', () => {
      const user = feUser.generateFromSnapshot({
        emailVerifiedAt: null,
        phone: null,
        phoneVerifiedAt: null,
      });
      const persistence = mapper.toPersistence(user);
      expect(persistence.user.email_verified_at).toBeNull();
      expect(persistence.user.phone).toBeNull();
      expect(persistence.user.phone_verified_at).toBeNull();
    });
  });

  describe('Round-trip Consistency', () => {
    it('should preserve data through persistence round trip', () => {
      const original = feUser.generate();
      const persistence = mapper.toPersistence(original);
      const reconstructed = mapper.toDomain(persistence);
      expect(reconstructed.toSnapshot()).toEqual(original.toSnapshot());
    });

    it('should preserve nullable fields through round trip', () => {
      const original = feUser.generateFromSnapshot({
        emailVerifiedAt: null,
        phone: null,
        phoneVerifiedAt: null,
      });
      const persistence = mapper.toPersistence(original);
      const reconstructed = mapper.toDomain(persistence);
      expect(reconstructed.toSnapshot()).toEqual(original.toSnapshot());
    });
  });
});
