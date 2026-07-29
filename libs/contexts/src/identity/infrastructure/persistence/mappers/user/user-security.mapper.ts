import { Instant, Mapper } from '@app/shared-kernel';
import type { UserSecuritySnapshot } from '../../../../domain/user/entities/user-security.entity';
import type { UserSecuritySnapRow } from './user.persistence.types';

export class UserSecurityMapper extends Mapper<UserSecuritySnapshot, UserSecuritySnapRow> {
  toDomain(raw: UserSecuritySnapRow): UserSecuritySnapshot {
    return {
      userId: raw.user_id,
      failedLoginAttempts: raw.failed_login_attempts,
      lastLoginAttemptedAt: raw.last_login_attempted_at
        ? Instant.fromDate(raw.last_login_attempted_at)
        : null,
      lastPasswordChangeAt: raw.last_password_change_at
        ? Instant.fromDate(raw.last_password_change_at)
        : null,
      lockoutReason: raw.lockout_reason,
      lockoutUntil: raw.lockout_until ? Instant.fromDate(raw.lockout_until) : null,
      mfaEnabledAt: raw.mfa_enabled_at ? Instant.fromDate(raw.mfa_enabled_at) : null,
      mfaLastUsedAt: raw.mfa_last_used_at ? Instant.fromDate(raw.mfa_last_used_at) : null,
      mfaSecretCiphertext: raw.mfa_secret_ciphertext,
      mfaSecretKid: raw.mfa_secret_kid,
      mfaStatus: raw.mfa_status,
      mfaType: raw.mfa_type,
    };
  }

  toPersistence(entity: UserSecuritySnapshot): UserSecuritySnapRow {
    return {
      user_id: entity.userId,
      mfa_enabled_at: entity.mfaEnabledAt?.toDate() ?? null,
      mfa_last_used_at: entity.mfaLastUsedAt?.toDate() ?? null,
      mfa_secret_ciphertext: entity.mfaSecretCiphertext,
      mfa_secret_kid: entity.mfaSecretKid,
      mfa_status: entity.mfaStatus,
      mfa_type: entity.mfaType,
      lockout_until: entity.lockoutUntil?.toDate() ?? null,
      lockout_reason: entity.lockoutReason,
      failed_login_attempts: entity.failedLoginAttempts,
      last_login_attempted_at: entity.lastLoginAttemptedAt?.toDate() ?? null,
      last_password_change_at: entity.lastPasswordChangeAt?.toDate() ?? null,
    };
  }
}
