import { CreateUserSecurityProps, UserSecurity, UserSecuritySnapshot } from '@app/domain/identity';
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
