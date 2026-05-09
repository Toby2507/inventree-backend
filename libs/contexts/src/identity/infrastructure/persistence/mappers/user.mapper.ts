import { Mapper } from '@app/common';
import { User } from '../../../domain';
import { UserPersistence } from '../types';

export class UserMapper extends Mapper<User, UserPersistence> {
  toDomain(raw: UserPersistence): User {
    const { user, security } = raw;

    return User.reconstitute({
      id: user.id,
      email: user.email,
      emailVerifiedAt: user.email_verified_at,
      phone: user.phone,
      phoneVerifiedAt: user.phone_verified_at,
      passwordHash: user.password_hash,
      firstName: user.first_name,
      lastName: user.last_name,
      displayName: user.display_name,
      status: user.status,
      createdAt: user.created_at,
      deletedAt: user.deleted_at,
      security: {
        userId: security.user_id,
        failedLoginAttempts: security.failed_login_attempts,
        lastLoginAttemptedAt: security.last_login_attempted_at,
        lastPasswordChangeAt: security.last_password_change_at,
        lockoutReason: security.lockout_reason,
        lockoutUntil: security.lockout_until,
        mfaEnabledAt: security.mfa_enabled_at,
        mfaLastUsedAt: security.mfa_last_used_at,
        mfaSecretCiphertext: security.mfa_secret_ciphertext,
        mfaSecretKid: security.mfa_secret_kid,
        mfaStatus: security.mfa_status,
        mfaType: security.mfa_type,
      },
    });
  }

  toPersistence(entity: User): UserPersistence {
    const user = entity.toSnapshot();
    const security = user.security;

    return {
      user: {
        id: user.id,
        email: user.email,
        email_verified_at: user.emailVerifiedAt,
        phone: user.phone,
        phone_verified_at: user.phoneVerifiedAt,
        password_hash: user.passwordHash,
        first_name: user.firstName,
        last_name: user.lastName,
        display_name: user.displayName,
        status: user.status,
        created_at: user.createdAt,
        deleted_at: user.deletedAt,
      },
      security: {
        user_id: security.userId,
        mfa_enabled_at: security.mfaEnabledAt,
        mfa_last_used_at: security.mfaLastUsedAt,
        mfa_secret_ciphertext: security.mfaSecretCiphertext,
        mfa_secret_kid: security.mfaSecretKid,
        mfa_status: security.mfaStatus,
        mfa_type: security.mfaType,
        lockout_until: security.lockoutUntil,
        lockout_reason: security.lockoutReason,
        failed_login_attempts: security.failedLoginAttempts,
        last_login_attempted_at: security.lastLoginAttemptedAt,
        last_password_change_at: security.lastPasswordChangeAt,
      },
    };
  }
}
