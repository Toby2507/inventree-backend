import { Mapper } from '@app/common';
import { UserSecuritySnapshot } from '../../../../domain/user/entities';
import { UserSecuritySnapRow } from './user.persistence.types';

export class UserSecurityMapper extends Mapper<UserSecuritySnapshot, UserSecuritySnapRow> {
  toDomain(raw: UserSecuritySnapRow): UserSecuritySnapshot {
    return {
      userId: raw.user_id,
      failedLoginAttempts: raw.failed_login_attempts,
      lastLoginAttemptedAt: raw.last_login_attempted_at,
      lastPasswordChangeAt: raw.last_password_change_at,
      lockoutReason: raw.lockout_reason,
      lockoutUntil: raw.lockout_until,
      mfaEnabledAt: raw.mfa_enabled_at,
      mfaLastUsedAt: raw.mfa_last_used_at,
      mfaSecretCiphertext: raw.mfa_secret_ciphertext,
      mfaSecretKid: raw.mfa_secret_kid,
      mfaStatus: raw.mfa_status,
      mfaType: raw.mfa_type,
    };
  }

  toPersistence(entity: UserSecuritySnapshot): UserSecuritySnapRow {
    return {
      user_id: entity.userId,
      mfa_enabled_at: entity.mfaEnabledAt,
      mfa_last_used_at: entity.mfaLastUsedAt,
      mfa_secret_ciphertext: entity.mfaSecretCiphertext,
      mfa_secret_kid: entity.mfaSecretKid,
      mfa_status: entity.mfaStatus,
      mfa_type: entity.mfaType,
      lockout_until: entity.lockoutUntil,
      lockout_reason: entity.lockoutReason,
      failed_login_attempts: entity.failedLoginAttempts,
      last_login_attempted_at: entity.lastLoginAttemptedAt,
      last_password_change_at: entity.lastPasswordChangeAt,
    };
  }
}
