import {
  CreateUserSecurityProps,
  UserSecurity,
  UserSecuritySnapshot,
} from '@app/contexts/identity/domain/user/entities/user-security.entity';
import { UserSecuritySnapRow } from '@app/contexts/identity/infrastructure/persistence/mappers/user/user.persistence.types';
import { faker } from '@faker-js/faker';
import { createEntityFaker, createFaker } from '../../faker-factory';

export const fsUserSecurity = createFaker<UserSecuritySnapshot>(() => ({
  userId: faker.string.uuid(),
  failedLoginAttempts: 0,
  lastLoginAttemptedAt: faker.date.past(),
  lockoutUntil: null,
  lockoutReason: null,
  lastPasswordChangeAt: faker.date.past(),
  mfaStatus: 'disabled',
  mfaType: null,
  mfaSecretCiphertext: null,
  mfaSecretKid: null,
  mfaEnabledAt: null,
  mfaLastUsedAt: null,
}));

export const fdUserSecurity = createFaker<UserSecuritySnapRow>(() => ({
  user_id: faker.string.uuid(),
  mfa_enabled_at: faker.date.past(),
  mfa_last_used_at: faker.date.past(),
  mfa_secret_ciphertext: Buffer.from(faker.string.alphanumeric(32)),
  mfa_secret_kid: faker.string.alphanumeric(64),
  mfa_status: 'disabled',
  mfa_type: null,
  lockout_until: faker.date.past(),
  lockout_reason: faker.lorem.sentence(),
  failed_login_attempts: 0,
  last_login_attempted_at: faker.date.past(),
  last_password_change_at: faker.date.past(),
}));

export const feUserSecurity = createEntityFaker<
  UserSecurity,
  CreateUserSecurityProps,
  UserSecuritySnapshot
>(
  UserSecurity,
  () => ({
    userId: faker.string.uuid(),
  }),
  fsUserSecurity.generate,
);
